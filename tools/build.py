"""Patch 11.w3x: add item 'RC01' cooldown-reduction trigger into war3map.j."""
import sys, os, struct, zlib
sys.path.insert(0, os.path.dirname(__file__))
from mpq import MPQFile, hash_string, decrypt, encrypt

SRC = 'work/11_orig.w3x'
DST = 'work/11_cdr.w3x'

JASS_ADD = b"""
//===========================================================================
// Trigger: cdr_item   (item 'RC01': -20% cooldown for the carrier)
//===========================================================================
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

function Trig_cdr_item_Actions takes nothing returns nothing
    local unit    u   = GetTriggerUnit()
    local integer aid = GetSpellAbilityId()
    local integer lvl = GetUnitAbilityLevel(u, aid)
    local real    cd
    if ( lvl > 0 ) and CDR_HasItem(u) then
        set cd = BlzGetUnitAbilityCooldown(u, aid, lvl)
        if ( cd > 0.0 ) then
            call BlzSetUnitAbilityCooldown(u, aid, lvl, cd * 0.80)
        endif
    endif
    set u = null
endfunction

function InitTrig_cdr_item takes nothing returns nothing
    set gg_trg_reduce_CD = CreateTrigger(  )
    call TriggerRegisterAnyUnitEventBJ( gg_trg_reduce_CD, EVENT_PLAYER_UNIT_SPELL_EFFECT )
    call TriggerAddAction( gg_trg_reduce_CD, function Trig_cdr_item_Actions )
endfunction

"""


def patch_jass(js):
    text = js.decode('latin-1')
    assert 'function InitCustomTriggers' in text
    add = JASS_ADD.decode('latin-1')
    out = text.replace('function InitCustomTriggers', add + 'function InitCustomTriggers', 1)
    import re
    pat = re.compile(r'( *)call InitTrig_improve_tech\( *\)(\r?\n)')
    mt = pat.search(out)
    assert mt, 'improve_tech init anchor missing'
    indent, nl = mt.group(1), mt.group(2)
    out = pat.sub(lambda mm: mm.group(0) + indent + 'call InitTrig_cdr_item(  )' + nl, out, count=1)
    return out.encode('latin-1')


def main():
    orig = open(SRC, 'rb').read()
    m = MPQFile(SRC)

    jass = m.read_file('war3map.j')
    assert b"InitCustomTriggers" in jass
    new_jass = patch_jass(jass)
    print('jass %d -> %d bytes' % (len(jass), len(new_jass)))

    data_end = m.hash_pos          # 19150, first byte of hash table, all file data before it
    data = orig[:data_end]
    assert len(data) == data_end

    jass_off = data_end
    jass_blob = new_jass           # stored uncompressed

    hash_off = jass_off + len(jass_blob)
    hash_tbl = bytearray(orig[m.hash_pos:m.block_pos])      # already encrypted, relocation-safe
    assert len(hash_tbl) == m.hash_size * 16

    # block table: decrypt, patch entry for war3map.j (block 2), re-encrypt
    raw_bt = orig[m.block_pos:m.block_pos + m.block_count * 16]
    bt = bytearray(decrypt(raw_bt, hash_string('(block table)', 3)))
    struct.pack_into('<IIII', bt, 2 * 16, jass_off, len(jass_blob), len(jass_blob), 0x80000000)
    bt_enc = encrypt(bytes(bt), hash_string('(block table)', 3))

    block_off = hash_off + len(hash_tbl)
    total = block_off + len(bt_enc)

    out = bytearray(data)
    out += jass_blob
    out += hash_tbl
    out += bt_enc

    # rewrite header
    struct.pack_into('<IIHHIIII', out, 4,
                     32, total, 0, m.block_shift,
                     hash_off, block_off,
                     m.hash_size, m.block_count)
    assert len(out) == total, (len(out), total)

    open(DST, 'wb').write(out)
    print('wrote %s (%d bytes)' % (DST, total))

    # verify
    c = MPQFile(DST)
    got = c.read_file('war3map.j')
    assert got == new_jass, 'roundtrip mismatch'
    for n in ['war3map.w3t', 'war3map.w3a', 'war3map.w3i', 'war3map.wtg', 'war3map.wts',
              'war3map.w3u', 'war3map.w3e', 'war3mapUnits.doo', 'war3mapMap.blp']:
        a = m.read_file(n)
        b = c.read_file(n)
        assert a == b, 'changed: ' + n
    assert open(SRC, 'rb').read()[32:m.hash_pos] == open(DST, 'rb').read()[32:m.hash_pos], 'body drift'
    print('verify OK; body byte-identical, other files identical')


if __name__ == '__main__':
    main()
