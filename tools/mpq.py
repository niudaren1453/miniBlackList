"""Minimal MPQ (Warcraft III .w3x/.w3m) reader."""
import struct, os, zlib, sys

MPQ_MAGIC = b'MPQ\x1a'
MPQ_USERDATA = b'MPQ\x1b'
MPQ_HEADER_V4 = b'MPQ\x04'

# crypt table
_crypt = None

def _build_crypt():
    global _crypt
    if _crypt:
        return _crypt
    table = [0] * 0x500
    seed = 0x00100001
    for i in range(0x100):
        idx = i
        for _ in range(5):
            seed = (seed * 125 + 3) % 0x2AAAAB
            temp1 = (seed & 0xFFFF) << 0x10
            seed = (seed * 125 + 3) % 0x2AAAAB
            temp2 = (seed & 0xFFFF)
            table[idx] = (temp1 | temp2) & 0xFFFFFFFF
            idx += 0x100
    _crypt = table
    return table

def hash_string(s, hash_type):
    table = _build_crypt()
    if isinstance(s, str):
        s = s.encode('ascii')
    seed1 = 0x7FED7FED
    seed2 = 0xEEEEEEEE
    for ch in s.upper():
        ch = ch if isinstance(ch, int) else ord(ch)
        seed1 = (table[(hash_type << 8) + ch] ^ ((seed1 + seed2) & 0xFFFFFFFF)) & 0xFFFFFFFF
        seed2 = (ch + seed1 + seed2 + (seed2 << 5) + 3) & 0xFFFFFFFF
    return seed1

def decrypt(data, key):
    table = _build_crypt()
    seed1 = key
    seed2 = 0xEEEEEEEE
    out = bytearray(data)
    for i in range(0, len(out) - 3, 4):
        seed2 = (seed2 + table[0x400 + (seed1 & 0xFF)]) & 0xFFFFFFFF
        ch = struct.unpack_from('<I', out, i)[0]
        ch = (ch ^ ((seed1 + seed2) & 0xFFFFFFFF)) & 0xFFFFFFFF
        struct.pack_into('<I', out, i, ch)
        seed1 = ((((~seed1) << 0x15) + 0x11111111) | (seed1 >> 0x0B)) & 0xFFFFFFFF
        seed2 = (ch + seed2 + (seed2 << 5) + 3) & 0xFFFFFFFF
    return bytes(out)


def encrypt(data, key):
    """MPQ encryption (inverse of decrypt)."""
    table = _build_crypt()
    seed1 = key
    seed2 = 0xEEEEEEEE
    out = bytearray(data)
    for i in range(0, len(out) - 3, 4):
        seed2 = (seed2 + table[0x400 + (seed1 & 0xFF)]) & 0xFFFFFFFF
        ch = struct.unpack_from('<I', out, i)[0]
        struct.pack_into('<I', out, i, (ch ^ ((seed1 + seed2) & 0xFFFFFFFF)) & 0xFFFFFFFF)
        seed1 = ((((~seed1) << 0x15) + 0x11111111) | (seed1 >> 0x0B)) & 0xFFFFFFFF
        seed2 = (ch + seed2 + (seed2 << 5) + 3) & 0xFFFFFFFF
    return bytes(out)


class MPQFile:
    def __init__(self, path):
        self.path = path
        self.data = open(path, 'rb').read()
        self._parse_header()
        self._read_tables()

    def _parse_header(self):
        data = self.data
        off = 0
        if data[:4] == MPQ_USERDATA:
            # header is 512 bytes into the file for old-style archives
            idx = data.find(MPQ_MAGIC, 0, 0x1000)
            if idx < 0:
                raise ValueError('no MPQ header')
            off = idx
        self.header_off = off
        magic = data[off:off + 4]
        if magic == MPQ_HEADER_V4:
            raise ValueError('MPQ format v4 not supported')
        if magic != MPQ_MAGIC:
            raise ValueError('bad magic %r at %d' % (magic, off))
        (hdr_size, arc_size, fmt_ver, block_shift,
         hash_pos, block_pos, hash_size, block_size) = struct.unpack_from('<IIHHIIII', data, off + 4)
        self.header_size = hdr_size
        self.archive_size = arc_size
        self.format_version = fmt_ver
        self.sector_size = 512 << block_shift
        self.hash_pos = hash_pos + off
        self.block_pos = block_pos + off
        self.hash_size = hash_size
        self.block_count = block_size
        self.block_shift = block_shift

    def _read_tables(self):
        d = self.data
        raw = d[self.hash_pos:self.hash_pos + self.hash_size * 16]
        # hash table is encrypted with key '(hash table)'
        key = hash_string('(hash table)', 3)
        raw = decrypt(raw, key)
        self.hash_entries = []
        for i in range(self.hash_size):
            name1, name2, loc, plat, blk = struct.unpack_from('<IIHHI', raw, i * 16)
            self.hash_entries.append((name1, name2, loc, plat, blk))
        rawb = d[self.block_pos:self.block_pos + self.block_count * 16]
        rawb = decrypt(rawb, hash_string('(block table)', 3))
        self.block_entries = []
        for i in range(self.block_count):
            fpos, csize, fsize, flags = struct.unpack_from('<IIII', rawb, i * 16)
            self.block_entries.append((fpos, csize, fsize, flags))

    def find_hash(self, name):
        h_off = hash_string(name, 0) & (self.hash_size - 1)
        h_a = hash_string(name, 1)
        h_b = hash_string(name, 2)
        start = h_off
        while True:
            if self.hash_entries[h_off][4] == 0xFFFFFFFF:
                return None
            if (self.hash_entries[h_off][0] == h_a and
                    self.hash_entries[h_off][1] == h_b):
                return h_off
            h_off = (h_off + 1) & (self.hash_size - 1)
            if h_off == start:
                return None

    def has_file(self, name):
        return self.find_hash(name) is not None

    def read_file(self, name):
        idx = self.find_hash(name)
        if idx is None:
            return None
        blk = self.hash_entries[idx][4]
        fpos, csize, fsize, flags = self.block_entries[blk]
        key = None
        if flags & 0x00010000:  # encrypted
            base = os.path.basename(name).replace('/', '\\')
            key = hash_string(base, 3)
            if flags & 0x00020000:  # fix key
                seed = (key + fpos) & 0xFFFFFFFF
                key = ((~seed << 0x15) + 0x11111111) | (seed >> 0x0B)
                key &= 0xFFFFFFFF
        start = self.header_off + fpos
        raw = self.data[start:start + csize]
        if flags & 0x01000000:  # single unit
            if flags & 0x00000200:
                mask = raw[0]
                body = raw[1:]
                raw = self._decompress(mask, body, fsize)
            if key is not None:
                raw = decrypt(raw, key)
            return raw[:fsize]
        # sector based
        if flags & 0x00000200:
            # read sector offset table
            if key is not None:
                sector_table = decrypt(raw, (key - 1) & 0xFFFFFFFF)
            else:
                sector_table = raw
            nsec = (fsize + self.sector_size - 1) // self.sector_size
            offsets = [struct.unpack_from('<I', sector_table, i * 4)[0] for i in range(nsec + 1)]
            out = bytearray()
            for i in range(nsec):
                s = offsets[i]
                e = offsets[i + 1]
                chunk = raw[s:e]
                if key is not None:
                    chunk = decrypt(chunk, (key + i) & 0xFFFFFFFF)
                if len(chunk) < fsize - len(out) :
                    mask = chunk[0]
                    chunk = self._decompress(mask, chunk[1:], min(self.sector_size, fsize - len(out)))
                else:
                    chunk = chunk[:min(self.sector_size, fsize - len(out))]
                out += chunk
            return bytes(out[:fsize])
        else:
            if key is not None:
                raw = decrypt(raw, key)
            return raw[:fsize]

    def _decompress(self, mask, body, expected):
        if mask & 0x02 or mask == 0x02:
            return zlib.decompress(body)
        if mask & 0x08:
            return explode(body)
        raise NotImplementedError('compression mask 0x%02x' % mask)

    def list_files(self):
        names = []
        for i, e in enumerate(self.hash_entries):
            if e[4] != 0xFFFFFFFF:
                names.append((i, e[4], self.block_entries[e[4]]))
        return names


def explode(data):
    """PKWARE DCL explode (implode decompression)."""
    out = bytearray()
    pos = [0]
    bits = [0]

    def getbits(n):
        v = 0
        for _ in range(n):
            if bits[0] == 0:
                if pos[0] >= len(data):
                    raise EOFError
                bits[1] = data[pos[0]]
                pos[0] += 1
                bits[0] = 8
            v = (v << 1) | ((bits[1] >> 7) & 1)
            bits[1] = (bits[1] << 1) & 0xFF
            bits[0] -= 1
        return v

    lit_len = getbits(8)
    dist_len = getbits(8)
    if lit_len == 0 or dist_len == 0:
        raise ValueError('bad implode header')

    nlit = lit_len + 1
    ndist = dist_len + 1
    lit = [0] * nlit
    for i in range(nlit - 1):
        lit[i] = getbits(8) if i < 256 else 0
    # codes beyond 255 are repeats
    for i in range(256, nlit - 1):
        lit[i] = 0
    return _explode_core(getbits, lit, nlit, ndist, out)


def _explode_core(getbits, lit, nlit, ndist, out):
    # Build canonical Huffman decode tables from code lengths (PKWARE implode style)
    raise NotImplementedError
