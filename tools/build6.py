"""CDR6: RC01 = -20%, RC02 = -10%, never stack (best one only). Clean, no debug."""
import sys, os, struct
sys.path.insert(0, os.path.dirname(__file__))
from mpq import MPQFile, hash_string, decrypt, encrypt

SRC = 'work/11_cur.w3x'
DST = 'work/11_cdr6.w3x'

NEW = """function CDR_Reduction takes unit u returns real
    local integer i = 0
    local integer id = 0
    local real r = 1.00
    loop
        exitwhen i > 5
        set id = GetItemTypeId(UnitItemInSlot(u, i))
        if ( id == 'RC01' ) and ( r > 0.80 ) then
            set r = 0.80
        endif
        if ( id == 'RC02' ) and ( r > 0.90 ) then
            set r = 0.90
        endif
        set i = i + 1
    endloop
    return r
endfunction

function Trig_reduce_CD_Conditions takes nothing returns boolean
    return true
endfunction

function Trig_reduce_CD_Actions takes nothing returns nothing
    local unit u = GetTriggerUnit()
    local integer aid = GetSpellAbilityId()
    local integer lvl = GetUnitAbilityLevel(u, aid)
    local ability a
    local real base = 0.00
    local real r = 1.00
    if ( lvl > 0 ) then
        set r = CDR_Reduction(u)
        if ( r < 1.00 ) then
            set a = BlzGetUnitAbility(u, aid)
            set base = BlzGetAbilityRealLevelField(a, ABILITY_RLF_COOLDOWN, lvl - 1)
            if ( base > 0.00 ) then
                call BlzSetUnitAbilityCooldown(u, aid, lvl - 1, base * r)
            endif
            set a = null
        endif
    endif
    set u = null
endfunction

function InitTrig_reduce_CD takes nothing returns nothing
    set gg_trg_reduce_CD = CreateTrigger(  )
    call TriggerRegisterAnyUnitEventBJ( gg_trg_reduce_CD, EVENT_PLAYER_UNIT_SPELL_CAST )
    call TriggerAddAction( gg_trg_reduce_CD, function Trig_reduce_CD_Actions )
endfunction
"""


def crlf(s):
    return s.replace('\r\n', '\n').replace('\n', '\r\n')


def patch_wct(w):
    s = w.find(b'function CDR_HasItem')
    assert s > 0, 'script text not found'
    ln = struct.unpack_from('<I', w, s - 4)[0]
    e = s + ln
    assert w[e - 2:e] == b'\r\n', 'text must end with CRLF'
    new = crlf(NEW).encode('utf-8')
    out = w[:s - 4] + struct.pack('<I', len(new)) + new + w[e:]
    return out


def patch_jass(js, old_text):
    """Replace exactly the old trigger text block inside war3map.j."""
    assert old_text in js, 'old trigger text not found verbatim in war3map.j'
    new = crlf(NEW).encode('utf-8')
    out = js.replace(old_text, new, 1)
    for name in ('InitTrig_add_skills', 'InitTrig_improve_tech', 'InitTrig_reduce_CD'):
        assert name in out.decode('latin-1'), 'lost ' + name
    return out


def main():
    orig = open(SRC, 'rb').read()
    m = MPQFile(SRC)
    wct_old = m.read_file('war3map.wct')
    s = wct_old.find(b'function CDR_HasItem')
    assert s > 0
    ln = struct.unpack_from('<I', wct_old, s - 4)[0]
    old_text = wct_old[s:s + ln]

    new_jass = patch_jass(m.read_file('war3map.j'), old_text)
    new_wct = patch_wct(wct_old)

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
    for i, e in enumerate(entries):
        struct.pack_into('<IIII', bt, i * 16, *e)
    bt_enc = encrypt(bytes(bt), hash_string('(block table)', 3))
    block_off = hash_off + len(hash_tbl)
    total = block_off + len(bt_enc)

    out = bytearray(body) + hash_tbl + bt_enc
    struct.pack_into('<IIHHIIII', out, 4, 32, total, 0, m.block_shift,
                     hash_off, block_off, m.hash_size, m.block_count)
    assert len(out) == total
    open(DST, 'wb').write(out)
    print('wrote', DST, total, '| jass', len(m.read_file('war3map.j')), '->', len(new_jass))

    c = MPQFile(DST)
    assert c.read_file('war3map.j') == new_jass
    assert c.read_file('war3map.wct') == new_wct
    for n in ['war3map.w3t', 'war3map.w3a', 'war3map.wtg', 'war3map.w3u', 'war3mapUnits.doo']:
        assert m.read_file(n) == c.read_file(n), n
    w = c.read_file('war3map.wct')
    s = w.find(b'function CDR_Reduction')
    ln = struct.unpack_from('<I', w, s - 4)[0]
    print('wct text len', ln, 'ends with', w[s + ln - 4:s + ln])
    print('verify OK')


if __name__ == '__main__':
    main()
