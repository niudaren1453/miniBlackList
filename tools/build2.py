"""Patch 11.w3x:
  1) replace the broken 'reduce CD' custom-text trigger in war3map.wct
  2) put the same trigger into war3map.j (so it works before WE re-saves)
"""
import sys, os, struct
sys.path.insert(0, os.path.dirname(__file__))
from mpq import MPQFile, hash_string, decrypt, encrypt

SRC = 'work/11_orig.w3x'
DST = 'work/11_cdr2.w3x'

NEW_CDR = """function Trig_reduce_CD_Conditions takes nothing returns boolean
    return true
endfunction

function CDR_HasItem takes unit u returns boolean
    local integer i = 0
    loop
        exitwhen i > 5
        if ( GetItemTypeId(UnitItemInSlot(u, i)) == 'RC01' ) then
            return true
        endif
        set i = i + 1
    endloop
    return false
endfunction

function Trig_reduce_CD_Actions takes nothing returns nothing
    local unit u = GetTriggerUnit()
    local integer aid = GetSpellAbilityId()
    local integer lvl = GetUnitAbilityLevel(u, aid)
    local real cd = 0.00
    if ( lvl > 0 ) and ( CDR_HasItem(u) ) then
        set cd = BlzGetUnitAbilityCooldown(u, aid, lvl)
        if ( cd > 0.00 ) then
            call BlzSetUnitAbilityCooldown(u, aid, lvl, cd * 0.80)
        endif
    endif
    set u = null
endfunction

function InitTrig_reduce_CD takes nothing returns nothing
    set gg_trg_reduce_CD = CreateTrigger(  )
    call TriggerRegisterAnyUnitEventBJ( gg_trg_reduce_CD, EVENT_PLAYER_UNIT_SPELL_EFFECT )
    call TriggerAddAction( gg_trg_reduce_CD, function Trig_reduce_CD_Actions )
endfunction
"""


def crlf(s):
    return s.replace('\r\n', '\n').replace('\n', '\r\n')


def patch_wct(w):
    i = w.find(b'function Trig_reduce_CD')
    assert i > 4, 'reduce_CD text not found in wct'
    old_len = struct.unpack_from('<I', w, i - 4)[0]
    new = crlf(NEW_CDR).encode('utf-8')
    return w[:i - 4] + struct.pack('<I', len(new)) + new + w[i + old_len:]


def patch_jass(js):
    txt = js.decode('latin-1')
    add = crlf(NEW_CDR)
    assert 'function InitCustomTriggers' in txt
    txt = txt.replace('function InitCustomTriggers', add + 'function InitCustomTriggers', 1)
    old = '    call InitTrig_improve_tech(  )\r\nendfunction'
    assert old in txt, 'improve_tech anchor'
    txt = txt.replace(old, '    call InitTrig_improve_tech(  )\r\n    call InitTrig_reduce_CD(  )\r\nendfunction', 1)
    return txt.encode('latin-1')


def main():
    orig = open(SRC, 'rb').read()
    m = MPQFile(SRC)

    new_jass = patch_jass(m.read_file('war3map.j'))
    new_wct = patch_wct(m.read_file('war3map.wct'))

    body = bytearray(orig[:m.hash_pos])
    entries = list(m.block_entries)

    def add_file(name, blob):
        off = len(body)
        body.extend(blob)
        entries[m.hash_entries[m.find_hash(name)][4]] = (off, len(blob), len(blob), 0x80000000)

    add_file('war3map.j', new_jass)
    add_file('war3map.wct', new_wct)

    hash_off = len(body)
    hash_tbl = orig[m.hash_pos:m.block_pos]
    raw_bt = orig[m.block_pos:m.block_pos + m.block_count * 16]
    bt = bytearray(decrypt(raw_bt, hash_string('(block table)', 3)))
    for i, (fp, cs, fs, fl) in enumerate(entries):
        struct.pack_into('<IIII', bt, i * 16, fp, cs, fs, fl)
    bt_enc = encrypt(bytes(bt), hash_string('(block table)', 3))
    block_off = hash_off + len(hash_tbl)
    total = block_off + len(bt_enc)

    out = bytearray(body) + hash_tbl + bt_enc
    struct.pack_into('<IIHHIIII', out, 4, 32, total, 0, m.block_shift,
                     hash_off, block_off, m.hash_size, m.block_count)
    assert len(out) == total
    open(DST, 'wb').write(out)
    print('wrote %s (%d bytes)' % (DST, total))
    print('jass %d -> %d, wct %d -> %d' % (len(m.read_file('war3map.j')), len(new_jass),
                                           len(m.read_file('war3map.wct')), len(new_wct)))

    c = MPQFile(DST)
    assert c.read_file('war3map.j') == new_jass
    assert c.read_file('war3map.wct') == new_wct
    for n in ['war3map.w3t', 'war3map.w3a', 'war3map.w3i', 'war3map.wtg', 'war3map.w3u']:
        assert m.read_file(n) == c.read_file(n), n
    print('verify OK')


if __name__ == '__main__':
    main()
