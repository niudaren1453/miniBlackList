"""Patch v4: use 0-based level index for Blz ability level fields + richer debug."""
import sys, os, struct
sys.path.insert(0, os.path.dirname(__file__))
from mpq import MPQFile, hash_string, decrypt, encrypt

SRC = 'work/11_orig.w3x'
DST = 'work/11_cdr4.w3x'

NEW = """function CDR_HasItem takes unit u returns boolean
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

function Trig_reduce_CD_Conditions takes nothing returns boolean
    return true
endfunction

function Trig_reduce_CD_Actions takes nothing returns nothing
    local unit u = GetTriggerUnit()
    local integer aid = GetSpellAbilityId()
    local integer lvl = GetUnitAbilityLevel(u, aid)
    local ability a = BlzGetUnitAbility(u, aid)
    local real rlf = 0.00
    local real b0 = 0.00
    local real b1 = 0.00
    if ( CDR_HasItem(u) ) and ( lvl > 0 ) then
        set rlf = BlzGetAbilityRealLevelField(a, ABILITY_RLF_COOLDOWN, lvl - 1)
        set b0 = BlzGetUnitAbilityCooldown(u, aid, lvl - 1)
        set b1 = BlzGetUnitAbilityCooldown(u, aid, lvl)
        call BJDebugMsg( "[CDR] " + I2S(aid) + " lv" + I2S(lvl) + " rlf=" + R2S(rlf) + " b0=" + R2S(b0) + " b1=" + R2S(b1) )
        if ( rlf > 0.00 ) then
            call BlzSetUnitAbilityCooldown(u, aid, lvl - 1, rlf * 0.80)
            call BJDebugMsg( "[CDR] set to " + R2S(rlf * 0.80) )
        endif
    endif
    set a = null
    set u = null
endfunction

function Trig_reduce_CD_After takes nothing returns nothing
    local unit u = GetTriggerUnit()
    local integer aid = GetSpellAbilityId()
    local integer lvl = GetUnitAbilityLevel(u, aid)
    local ability a = BlzGetUnitAbility(u, aid)
    if ( lvl > 0 ) then
        call BJDebugMsg( "[CDR] after " + I2S(aid) + " rem0=" + R2S(BlzGetUnitAbilityCooldownRemaining(u, aid, 0)) + " rem1=" + R2S(BlzGetUnitAbilityCooldownRemaining(u, aid, 1)) + " rlf0=" + R2S(BlzGetAbilityRealLevelField(a, ABILITY_RLF_COOLDOWN, 0)) )
    endif
    set a = null
    set u = null
endfunction

function InitTrig_reduce_CD takes nothing returns nothing
    local trigger t
    set gg_trg_reduce_CD = CreateTrigger(  )
    call TriggerRegisterAnyUnitEventBJ( gg_trg_reduce_CD, EVENT_PLAYER_UNIT_SPELL_CAST )
    call TriggerAddAction( gg_trg_reduce_CD, function Trig_reduce_CD_Actions )
    set t = CreateTrigger(  )
    call TriggerRegisterAnyUnitEventBJ( t, EVENT_PLAYER_UNIT_SPELL_EFFECT )
    call TriggerAddAction( t, function Trig_reduce_CD_After )
    set t = null
endfunction
"""


def crlf(s):
    return s.replace('\r\n', '\n').replace('\n', '\r\n')


def patch_wct(w):
    i = w.find(b'function Trig_reduce_CD')
    assert i > 4
    old_len = struct.unpack_from('<I', w, i - 4)[0]
    new = crlf(NEW).encode('utf-8')
    return w[:i - 4] + struct.pack('<I', len(new)) + new + w[i + old_len:]


def patch_jass(js):
    txt = js.decode('latin-1')
    txt = txt.replace('function InitCustomTriggers', crlf(NEW) + 'function InitCustomTriggers', 1)
    old = '    call InitTrig_improve_tech(  )\r\nendfunction'
    assert old in txt
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
    print('wrote', DST, total)

    c = MPQFile(DST)
    assert c.read_file('war3map.j') == new_jass
    assert c.read_file('war3map.wct') == new_wct
    print('verify OK')


if __name__ == '__main__':
    main()
