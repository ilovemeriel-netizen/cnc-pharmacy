import { useEffect, useState, useRef, createContext, useContext } from 'react'
import { supabase } from './lib/supabase'
import * as XLSX from 'xlsx'

/* ═══════════════════════════════════════════════════
   CNC Pharmacy · Soft UI + Eco-Minimalism
   세이지 그린 + 오프 화이트 · 다크 헤더
   ═══════════════════════════════════════════════════ */
const themes = {
  light: {
    bg:'#F7F6F3', card:'#FFFFFF', cardSolid:'#FFFFFF', glass:'rgba(255,255,255,0.9)',
    border:'#E8E6E1', borderH:'#D7D7D7',
    text:'#2E4A62', textM:'#52524E', textL:'#A3A39E',
    accent:'#804A87', accentL:'#F5EDF6',
    green:'#019748', greenL:'#E6F7EE', red:'#C62828', redL:'#FFEBEE',
    amber:'#E65100', amberL:'#FFF3E0', blue:'#2E4A62', blueL:'#EAF0F5',
    purple:'#804A87', purpleL:'#F5EDF6',
    mint:'#7FD9A8', coral:'#F39E94', lavender:'#BFA6D9', pink:'#E2A6D4',
    nav:'#2E4A62', navText:'#F7F6F3', navHi:'#BFA6D9',
    shadow:'0 2px 8px rgba(46,74,98,0.06)', shadowH:'0 8px 24px rgba(46,74,98,0.10)',
  },
  dark: {
    bg:'#121820', card:'#1A2332', cardSolid:'#1E2A3A', glass:'rgba(26,35,50,0.9)',
    border:'#2A3A4A', borderH:'#3A4A5A',
    text:'#E8E6E1', textM:'#A3A39E', textL:'#6B7B8B',
    accent:'#BFA6D9', accentL:'rgba(191,166,217,0.12)',
    green:'#7FD9A8', greenL:'rgba(127,217,168,0.12)', red:'#F39E94', redL:'rgba(243,158,148,0.12)',
    amber:'#FFB74D', amberL:'rgba(255,183,77,0.12)', blue:'#92C8E0', blueL:'rgba(146,200,224,0.12)',
    purple:'#BFA6D9', purpleL:'rgba(191,166,217,0.12)',
    mint:'#7FD9A8', coral:'#F39E94', lavender:'#BFA6D9', pink:'#E2A6D4',
    nav:'#1A2332', navText:'#E8E6E1', navHi:'#BFA6D9',
    shadow:'0 2px 8px rgba(0,0,0,0.3)', shadowH:'0 8px 24px rgba(0,0,0,0.4)',
  }
}
const ThemeCtx = createContext()
function useTheme() { return useContext(ThemeCtx) }
const CATS = ['경구제','주사제','외용제','수액제','영양제','의약외품']
const STATS = ['사용','중지','휴면']
const PP = 20
const TYPES = ['입고','출고','반품','폐기']

/* ── Helpers ── */
function exS(d, t) { if (!d) return {}; const x = Math.floor((new Date(d) - new Date()) / 864e5); if (x <= 0) return { color: t.red, fontWeight: 700 }; if (x <= 30) return { color: t.red, fontWeight: 600 }; if (x <= 90) return { color: t.amber, fontWeight: 600 }; return { color: t.textM } }
function exD(d) { if (!d) return null; return Math.floor((new Date(d) - new Date()) / 864e5) }
function getNT(d) { if (d.narcotic_type === '향정' || d.narcotic_type === '마약') return d.narcotic_type; if (d.is_narcotic === true || d.is_narcotic === 'true') return '향정'; return '일반' }
function isN(d) { return getNT(d) !== '일반' }
function NT({ d }) { const { t } = useTheme(); const n = getNT(d); if (n === '일반') return null; const c = n === '마약' ? t.red : t.purple; return <span style={{ marginLeft: 4, background: n === '마약' ? t.redL : t.purpleL, color: c, fontSize: 9, padding: '2px 6px', borderRadius: 6, fontWeight: 600 }}>{n}</span> }
async function fetchAll() { let a = [], f = 0; while (true) { const { data, error } = await supabase.from('drugs').select('*').order('drug_name').range(f, f + 999); if (error || !data || !data.length) break; a = [...a, ...data]; if (data.length < 1000) break; f += 1000 }; return a }
async function searchDrugAPI(keyword, apiType = 'easy') {
  const maps = {
    easy: i => ({ name: i.itemName||'', ingredient: i.efcyQesitm||'', manufacturer: i.entpName||'', storage: i.depositMethodQesitm||'', usage: i.useMethodQesitm||'', warning: i.atpnWarnQesitm||'', sideEffect: i.seQesitm||'', image: i.itemImage||'' }),
    permit: i => ({ name: i.ITEM_NAME||'', permitNo: i.ITEM_SEQ||'', manufacturer: i.ENTP_NAME||'', permitDate: i.ITEM_PERMIT_DATE||'', storageMethod: i.STORAGE_METHOD||'', validPeriod: i.VALID_TERM||'', ingredient: i.MAIN_ITEM_INGR||'' }),
    ati: i => ({ name: i.ITEM_NAME||'', permitNo: i.ITEM_SEQ||'', manufacturer: i.ENTP_NAME||'', permitDate: i.ITEM_PERMIT_DATE||'', storageMethod: i.STORAGE_METHOD||'', validPeriod: i.VALID_TERM||'', ingredient: i.MAIN_ITEM_INGR||'' }),
    identify: i => ({ name: i.ITEM_NAME||'', shape: i.DRUG_SHAPE||'', color: i.COLOR_CLASS1||'', mark: i.MARK_CODE_FRONT||'', image: i.ITEM_IMAGE||'', line: i.LINE_FRONT||'' }),
    dur: i => ({ name: i.ITEM_NAME||'', durType: i.DUR_SEQ||'', ingredient: i.INGR_NAME||'', manufacturer: i.ENTP_NAME||'', prohibit: i.PROHBT_CONTENT||'' }),
    maxDose: i => ({ name: i.ITEM_NAME||'', ingredient: i.INGR_NAME||'', maxDailyDose: i.DAILY_MAX_DOSG_QY||i.MAX_DAY_QTY||'', unit: i.DAILY_MAX_DOSG_QY_UNIT||i.MAX_DAY_QTY_UNIT||'' })
  }
  const mapFn = maps[apiType] || maps.easy
  // 1차: Netlify 서버 함수 시도 (배포 환경 — 모든 API CORS 우회)
  try {
    const proxyUrl = `/api/drug?keyword=${encodeURIComponent(keyword)}&type=${apiType}`
    const res = await fetch(proxyUrl)
    if (res.ok) { const json = await res.json(); if (json.ok && json.data?.length) return { ok: true, data: json.data.map(mapFn) }; if (!json.ok && json.msg) return json; return { ok: true, data: [], msg: '검색 결과가 없습니다' } }
  } catch { /* 로컬 환경 — 서버 함수 없음 → 2차 시도 */ }
  // 2차: 브라우저 직접 호출 (로컬 개발 환경)
  const apiKey = import.meta.env.VITE_DATA_API_KEY
  if (!apiKey || apiKey.includes('여기에')) return { ok: false, msg: '.env 파일에 VITE_DATA_API_KEY를 설정하세요.', data: [] }
  const directAPIs = {
    easy: { url: 'https://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList', param: 'itemName' },
    permit: { url: 'https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService05/getDrugPrdtPrmsnDtlInq04', param: 'item_name' },
    ati: { url: 'https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService05/getDrugPrdtPrmsnDtlInq04', param: 'item_name' },
    identify: { url: 'https://apis.data.go.kr/1471000/MdcinGrnIdntfcInfoService01/getMdcinGrnIdntfcInfoList01', param: 'item_name' },
    dur: { url: 'https://apis.data.go.kr/1471000/DURPrdlstInfoService03/getDurPrdlstInfoList03', param: 'itemName' },
    maxDose: { url: 'https://apis.data.go.kr/1471000/DailyMaxDosgQyInfoService/getDailyMaxDosgQyList', param: 'itemName' }
  }
  const api = directAPIs[apiType] || directAPIs.easy
  try {
    const url = `${api.url}?serviceKey=${apiKey}&${api.param}=${encodeURIComponent(keyword)}&type=json&numOfRows=15`
    const res = await fetch(url); const text = await res.text()
    try { const json = JSON.parse(text); const body = json?.body || json?.response?.body; const items = body?.items?.item || body?.items || []; return { ok: true, data: (Array.isArray(items) ? items : [items]).filter(i => i).map(mapFn) } }
    catch { return { ok: false, msg: '응답 파싱 실패', data: [] } }
  } catch (e) { return { ok: false, msg: e.message === 'Failed to fetch' ? 'CORS 차단 — 배포 후 자동 해결됩니다' : e.message, data: [] } }
}

/* ── Sort Hook ── */
function useSort(ik = '', id = 'asc') {
  const [sk, s1] = useState(ik); const [sd, s2] = useState(id)
  return { sk, sd,
    hs(k) { if (sk === k) { if (sd === 'asc') s2('desc'); else { s1(''); s2('asc') } } else { s1(k); s2('asc') } },
    so(a) { if (!sk) return a; return [...a].sort((x, y) => { let va = x[sk] ?? '', vb = y[sk] ?? ''; if (typeof va === 'number' && typeof vb === 'number') return sd === 'asc' ? va - vb : vb - va; return sd === 'asc' ? String(va).localeCompare(String(vb), 'ko') : String(vb).localeCompare(String(va), 'ko') }) },
    SI({ col: c }) { const { t } = useTheme(); if (sk !== c) return <span style={{ color: t.textL, fontSize: 9, marginLeft: 3 }}>⇅</span>; return <span style={{ color: t.accent, fontSize: 9, marginLeft: 3 }}>{sd === 'asc' ? '▲' : '▼'}</span> },
    TS(c) { const { t } = useTheme(); return { padding: '10px 12px', textAlign: 'left', color: sk === c ? t.accent : t.textM, fontWeight: 600, borderBottom: `1px solid ${t.border}`, whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none', background: sk === c ? t.accentL : 'transparent', fontSize: 11 } }
  }
}

/* ── UI Atoms ── */
function Bd({ children, bg, color }) { return <span style={{ background: bg, color, padding: '3px 10px', borderRadius: 8, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>{children}</span> }
function SB({ s }) { const { t } = useTheme(); const m = { '사용': [t.greenL, t.green], '중지': ['#F0F0EB', t.textL], '휴면': [t.amberL, t.amber] }; const [b, c] = m[s] || ['#F0F0EB', t.textL]; return <Bd bg={b} color={c}>{s}</Bd> }
function Ft() { const { t } = useTheme(); return <div style={{ textAlign: 'center', padding: '20px 0 12px', fontSize: 11, color: t.textL, borderTop: `1px solid ${t.border}`, marginTop: 24 }}>Developed by <strong style={{ color: t.accent }}>이정화</strong> · 씨엔씨재활의학과 약무팀 · 2026</div> }
function Pg({ page: p, setPage: sp, tp, fl, pp }) { const { t } = useTheme(); if (tp <= 1) return null; const btn = dis => ({ padding: '5px 12px', borderRadius: 8, border: `1px solid ${t.border}`, cursor: dis ? 'not-allowed' : 'pointer', background: t.card, color: dis ? t.textL : t.text, fontWeight: 600, fontSize: 11, opacity: dis ? .4 : 1 }); return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: `1px solid ${t.border}` }}><span style={{ fontSize: 11, color: t.textM }}>{fl.length}개 중 {Math.min((p - 1) * pp + 1, fl.length)}–{Math.min(p * pp, fl.length)}</span><div style={{ display: 'flex', gap: 3 }}><button onClick={() => sp(x => x - 1)} disabled={p === 1} style={btn(p === 1)}>◀</button>{Array.from({ length: Math.min(5, tp) }, (_, i) => { const pg = Math.max(1, Math.min(p - 2, tp - 4)) + i; return <button key={pg} onClick={() => sp(pg)} style={{ ...btn(false), background: p === pg ? t.accent : t.card, color: p === pg ? '#fff' : t.text, border: `1px solid ${p === pg ? t.accent : t.border}` }}>{pg}</button> })}<button onClick={() => sp(x => x + 1)} disabled={p === tp} style={btn(p === tp)}>▶</button></div></div> }
function CN({ drug: d, onEdit }) { const { t } = useTheme(); return <td style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'left', color: t.accent, cursor: 'pointer' }} onClick={() => onEdit(d)} onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline'; e.currentTarget.style.color = t.purple }} onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none'; e.currentTarget.style.color = t.accent }}>{d.drug_name}</td> }

/* ★ MultiPill — 최종 */
function MP({ items, selected, onChange, color, label }) {
  const { t } = useTheme(); const allSel = selected.length === items.length
  function tog(item) { const n = selected.includes(item) ? selected.filter(x => x !== item) : [...selected, item]; onChange(n.length ? n : [...items]) }
  const on = { padding: '5px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 600, background: color, color: '#fff', border: `1.5px solid ${color}`, transition: 'all .15s' }
  const off = { padding: '5px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 500, background: 'transparent', color: t.textM, border: `1.5px solid ${t.border}`, transition: 'all .15s' }
  return <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
    {label && <span style={{ fontSize: 10, color: t.textL, fontWeight: 600, marginRight: 3 }}>{label}</span>}
    <button onClick={() => onChange(allSel ? [items[0]] : [...items])} style={allSel ? { ...on, background: t.text, borderColor: t.text } : off}>전체</button>
    {items.map(i => <button key={i} onClick={() => tog(i)} style={selected.includes(i) ? on : off}>{i}</button>)}
  </div>
}

/* ★ ColToggle — position:fixed로 부모 overflow 무시 */
function ColToggle({ cols, visible, setVisible }) {
  const { t } = useTheme(); const [open, setOpen] = useState(false); const btnRef = useRef(); const [pos, setPos] = useState({ top: 0, right: 0 })
  function toggle() { if (!open && btnRef.current) { const r = btnRef.current.getBoundingClientRect(); setPos({ top: r.bottom + 6, right: window.innerWidth - r.right }) }; setOpen(!open) }
  return <div style={{ position: 'relative' }}>
    <button ref={btnRef} onClick={toggle} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${open ? t.accent : t.border}`, background: open ? t.accentL : t.card, color: open ? t.accent : t.textM, cursor: 'pointer', fontSize: 11, fontWeight: 600, boxShadow: t.shadow }}>컬럼 ⚙</button>
    {open && <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setOpen(false)} />
      <div style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999, background: t.cardSolid, border: `1px solid ${t.borderH}`, borderRadius: 12, padding: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.18)', minWidth: 220, maxHeight: 350, overflowY: 'auto' }}>
        <div style={{ fontSize: 12, color: t.text, marginBottom: 10, fontWeight: 700 }}>표시할 컬럼 선택</div>
        {cols.map(c => <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', cursor: 'pointer', fontSize: 12, color: t.text }}>
          <input type="checkbox" checked={visible.includes(c.key)} onChange={() => { const n = visible.includes(c.key) ? visible.filter(x => x !== c.key) : [...visible, c.key]; setVisible(n.length ? n : cols.map(x => x.key)) }} style={{ accentColor: t.accent }} />{c.label}
        </label>)}
        <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 8, paddingTop: 8, display: 'flex', gap: 4 }}>
          <button onClick={() => setVisible(cols.map(x => x.key))} style={{ flex: 1, padding: '5px', borderRadius: 6, border: `1px solid ${t.border}`, background: 'transparent', color: t.textM, cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>전체</button>
          <button onClick={() => setVisible(cols.filter(x => x.default).map(x => x.key))} style={{ flex: 1, padding: '5px', borderRadius: 6, border: `1px solid ${t.accent}`, background: t.accentL, color: t.accent, cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>기본</button>
        </div>
      </div>
    </>}
  </div>
}

/* ═══ 약품 수정 모달 ═══ */
function DrugEditModal({ drug: dr, onClose, onSaved, onLotManage }) {
  const { t } = useTheme(); const oc = dr.drug_code || ''
  const [f, sF] = useState({ drug_code: oc, drug_name: dr.drug_name || '', category: dr.category || '', ingredient_en: dr.ingredient_en || '', ingredient_kr: dr.ingredient_kr || '', efficacy: dr.efficacy || '', manufacturer: dr.manufacturer || '', specification: dr.specification || '', unit: dr.unit || '', price_per_bottle: dr.price_per_bottle || 0, price_unit: dr.price_unit || 0, current_qty: dr.current_qty || 0, expiry_date: dr.expiry_date || '', status: dr.status || '사용', narcotic_type: getNT(dr), safety_stock: dr.safety_stock || 0, max_stock: dr.max_stock || 0, lot_no: dr.lot_no || '', standard_code: dr.standard_code || '', edi_price: dr.edi_price || 0, insurance_type: dr.insurance_type || '보험', storage_method: dr.storage_method || '', storage_location: dr.storage_location || '', notes: dr.notes || '' })
  const [saving, setSaving] = useState(false); const [msg, setMsg] = useState(null); const [tab, setTab] = useState('basic')
  function set(k, v) { sF(p => ({ ...p, [k]: v })) }
  async function save() { if (!f.drug_name.trim()) { setMsg('약품명 필수'); return }; setSaving(true); setMsg(null); const ud = { drug_name: f.drug_name, category: f.category, ingredient_kr: f.ingredient_kr, manufacturer: f.manufacturer, price_unit: Number(f.price_unit) || 0, current_qty: Number(f.current_qty) || 0, expiry_date: f.expiry_date || null, status: f.status, is_narcotic: f.narcotic_type !== '일반' }; if (f.drug_code.trim() !== oc) ud.drug_code = f.drug_code.trim(); const ts = (k, v) => { if (k in dr) ud[k] = v };['narcotic_type', 'lot_no', 'standard_code', 'insurance_type', 'ingredient_en', 'efficacy', 'specification', 'unit', 'storage_method', 'storage_location', 'notes'].forEach(k => ts(k, f[k]));['edi_price', 'price_per_bottle', 'safety_stock', 'max_stock'].forEach(k => ts(k, Number(f[k]) || 0)); const res = dr.id ? await supabase.from('drugs').update(ud).eq('id', dr.id) : await supabase.from('drugs').update(ud).eq('drug_code', oc); setSaving(false); if (res.error) { setMsg(res.error.message); return }; setMsg('OK'); setTimeout(() => { onSaved?.(); onClose() }, 500) }
  const ip = { width: '100%', padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: t.bg, color: t.text }
  const lb = { fontSize: 10, color: t.textM, marginBottom: 4, display: 'block', fontWeight: 600 }; const cc = f.drug_code.trim() !== oc
  return <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
    <div style={{ background: t.cardSolid, borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${t.border}`, boxShadow: t.shadowH }} onClick={e => e.stopPropagation()}>
      <div style={{ padding: '18px 24px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div><div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>약품 정보 수정</div><div style={{ fontSize: 11, color: t.textM, marginTop: 2 }}>코드: {oc}</div></div>
        <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', cursor: 'pointer', fontSize: 16, color: t.textM }}>✕</button>
      </div>
      <div style={{ padding: '12px 24px 4px', display: 'flex', gap: 6 }}>{['basic', 'extra'].map(tb => <button key={tb} onClick={() => setTab(tb)} style={{ padding: '6px 16px', borderRadius: 8, border: `1px solid ${tab === tb ? t.accent : t.border}`, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: tab === tb ? t.accentL : 'transparent', color: tab === tb ? t.accent : t.textM }}>{tb === 'basic' ? '기본 정보' : '추가 정보'}</button>)}</div>
      <div style={{ padding: '12px 24px 20px' }}>
        {msg && <div style={{ background: msg === 'OK' ? t.greenL : t.redL, borderRadius: 8, padding: '10px', marginBottom: 12, color: msg === 'OK' ? t.green : t.red, fontSize: 13, fontWeight: 600 }}>{msg === 'OK' ? '저장 완료!' : msg}</div>}
        {tab === 'basic' && <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}><div><label style={lb}>약품코드</label><input value={f.drug_code} onChange={e => set('drug_code', e.target.value)} style={{ ...ip, borderColor: cc ? t.amber : t.border }} />{cc && <div style={{ fontSize: 10, color: t.amber, marginTop: 2 }}>⚠ {oc} → {f.drug_code.trim()}</div>}</div><div><label style={lb}>약품명 *</label><input value={f.drug_name} onChange={e => set('drug_name', e.target.value)} style={ip} /></div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}><div><label style={lb}>구분</label><select value={f.category} onChange={e => set('category', e.target.value)} style={ip}>{CATS.map(c => <option key={c}>{c}</option>)}</select></div><div><label style={lb}>상태</label><select value={f.status} onChange={e => set('status', e.target.value)} style={ip}>{STATS.map(s => <option key={s}>{s}</option>)}</select></div><div><label style={lb}>보험유형</label><div style={{ display: 'flex', gap: 4 }}>{['보험', '비보험'].map(x => <button key={x} onClick={() => set('insurance_type', x)} style={{ flex: 1, padding: '8px', borderRadius: 6, border: `1px solid ${f.insurance_type === x ? t.blue : t.border}`, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: f.insurance_type === x ? t.blueL : 'transparent', color: f.insurance_type === x ? t.blue : t.textL }}>{x}</button>)}</div></div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}><div><label style={lb}>성분명(한글)</label><input value={f.ingredient_kr} onChange={e => set('ingredient_kr', e.target.value)} style={ip} /></div><div><label style={lb}>제조사</label><input value={f.manufacturer} onChange={e => set('manufacturer', e.target.value)} style={ip} /></div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}><div><label style={lb}>규격</label><input value={f.specification} onChange={e => set('specification', e.target.value)} style={ip} /></div><div><label style={lb}>단위</label><input value={f.unit} onChange={e => set('unit', e.target.value)} style={ip} /></div><div><label style={lb}>개당단가</label><input type="number" value={f.price_unit} onChange={e => set('price_unit', e.target.value)} style={ip} /></div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}><div><label style={lb}>현재고</label><input type="number" value={f.current_qty} onChange={e => set('current_qty', e.target.value)} style={ip} /></div><div><label style={lb}>안전재고</label><input type="number" value={f.safety_stock} onChange={e => set('safety_stock', e.target.value)} style={ip} /></div><div><label style={lb}>최대재고</label><input type="number" value={f.max_stock} onChange={e => set('max_stock', e.target.value)} style={ip} /></div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}><div><label style={lb}>유효기한</label><input type="date" value={f.expiry_date} onChange={e => set('expiry_date', e.target.value)} style={ip} /></div><div><label style={lb}>LOT 번호</label><div style={{ display: 'flex', gap: 4 }}><input value={f.lot_no} onChange={e => set('lot_no', e.target.value)} style={{ ...ip, flex: 1 }} /><button onClick={() => onLotManage?.(dr)} style={{ padding: '0 10px', borderRadius: 6, border: `1px solid ${t.blue}`, background: t.blueL, color: t.blue, cursor: 'pointer', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>LOT관리</button></div></div></div>
          <div><label style={lb}>향정·마약</label><div style={{ display: 'flex', gap: 4 }}>{['일반', '향정', '마약'].map(x => { const a = f.narcotic_type === x, cl = x === '일반' ? t.green : x === '향정' ? t.purple : t.red; return <button key={x} onClick={() => set('narcotic_type', x)} style={{ flex: 1, padding: '8px', borderRadius: 6, border: `1px solid ${a ? cl : t.border}`, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: a ? cl + '18' : 'transparent', color: a ? cl : t.textL }}>{x}</button> })}</div></div>
        </>}
        {tab === 'extra' && <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}><div><label style={lb}>표준코드</label><input value={f.standard_code} onChange={e => set('standard_code', e.target.value)} style={ip} /></div><div><label style={lb}>EDI 단가</label><input type="number" value={f.edi_price} onChange={e => set('edi_price', e.target.value)} style={ip} /></div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}><div><label style={lb}>보관방법</label><select value={f.storage_method} onChange={e => set('storage_method', e.target.value)} style={ip}><option value="">선택</option><option>실온</option><option>냉장</option><option>냉동</option><option>차광</option></select></div><div><label style={lb}>보관위치</label><input value={f.storage_location} onChange={e => set('storage_location', e.target.value)} style={ip} /></div></div>
          <div style={{ marginBottom: 10 }}><label style={lb}>효능</label><input value={f.efficacy} onChange={e => set('efficacy', e.target.value)} style={ip} /></div>
          <div><label style={lb}>비고</label><textarea value={f.notes} onChange={e => set('notes', e.target.value)} rows={3} style={{ ...ip, resize: 'vertical' }} /></div>
        </>}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}><button onClick={onClose} style={{ flex: 1, padding: 11, borderRadius: 8, border: `1px solid ${t.border}`, cursor: 'pointer', background: 'transparent', color: t.textM, fontSize: 13, fontWeight: 600 }}>취소</button><button onClick={save} disabled={saving} style={{ flex: 2, padding: 11, borderRadius: 8, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', background: saving ? t.textL : t.accent, color: '#fff', fontSize: 13, fontWeight: 700 }}>{saving ? '저장 중...' : '저장'}</button></div>
      </div>
    </div>
  </div>
}

/* ═══ 재고 보정 모달 ═══ */
function AdjustModal({ drug: dr, onClose, onSaved }) {
  const { t } = useTheme(); const [qty, setQty] = useState(dr.current_qty || 0); const [reason, setReason] = useState('실사 결과 반영'); const [saving, setSaving] = useState(false); const [msg, setMsg] = useState(null); const [logTx, setLogTx] = useState(true); const diff = qty - (dr.current_qty || 0)
  async function save() { if (!reason.trim()) { setMsg('사유 필수'); return }; setSaving(true)
    await supabase.from('drugs').update({ current_qty: Number(qty) }).eq('drug_code', dr.drug_code)
    if (logTx) { await supabase.from('transactions').insert([{ drug_code: dr.drug_code, type: '보정', quantity: Math.abs(diff), unit_price: dr.price_unit || 0, total_amount: Math.abs(diff) * (dr.price_unit || 0), reason: `[재고보정] ${reason} (${diff > 0 ? '+' : ''}${diff})`, handler: '이정화', transaction_date: new Date().toISOString().split('T')[0], process_status: '완료' }]) }
    setSaving(false); setMsg('OK'); setTimeout(() => { onSaved?.(); onClose() }, 500) }
  const ip = { width: '100%', padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: t.bg, color: t.text }
  return <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
    <div style={{ background: t.cardSolid, borderRadius: 16, width: '100%', maxWidth: 420, border: `1px solid ${t.border}`, boxShadow: t.shadowH }} onClick={e => e.stopPropagation()}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border}` }}><div style={{ fontSize: 15, fontWeight: 700, color: t.amber }}>재고 보정</div><div style={{ fontSize: 12, color: t.textM, marginTop: 2 }}>{dr.drug_name}</div></div>
      <div style={{ padding: '16px 20px' }}>
        {msg && <div style={{ background: msg === 'OK' ? t.greenL : t.redL, borderRadius: 8, padding: '8px 12px', marginBottom: 10, color: msg === 'OK' ? t.green : t.red, fontSize: 12, fontWeight: 600 }}>{msg === 'OK' ? '보정 완료' : msg}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div style={{ background: t.bg, borderRadius: 10, padding: '12px', textAlign: 'center', border: `1px solid ${t.border}` }}><div style={{ fontSize: 10, color: t.textM }}>서류재고</div><div style={{ fontSize: 22, fontWeight: 700, color: t.text, marginTop: 4 }}>{(dr.current_qty || 0).toLocaleString()}</div></div>
          <div style={{ background: t.bg, borderRadius: 10, padding: '12px', textAlign: 'center', border: `1px solid ${diff !== 0 ? t.amber : t.border}` }}><div style={{ fontSize: 10, color: t.textM }}>실재고</div><input type="number" value={qty} onChange={e => setQty(Number(e.target.value))} style={{ width: '100%', textAlign: 'center', fontSize: 22, fontWeight: 700, border: 'none', background: 'transparent', color: t.text, outline: 'none', marginTop: 4 }} /></div>
        </div>
        {diff !== 0 && <div style={{ background: diff > 0 ? t.greenL : t.redL, borderRadius: 8, padding: '10px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600 }}><span style={{ color: diff > 0 ? t.green : t.red }}>차이: {diff > 0 ? '+' : ''}{diff}</span><span style={{ color: t.textM }}>수량 보정</span></div>}
        <div style={{ marginBottom: 10 }}><label style={{ fontSize: 10, color: t.textM, display: 'block', marginBottom: 4 }}>보정 사유 *</label><select value={reason} onChange={e => setReason(e.target.value)} style={ip}><option>실사 결과 반영</option><option>전산 오류 수정</option><option>파손/분실 확인</option><option>이관 수량 반영</option><option>기타</option></select></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, cursor: 'pointer', fontSize: 11, color: t.textM }}>
          <input type="checkbox" checked={logTx} onChange={e => setLogTx(e.target.checked)} style={{ accentColor: t.accent }} />
          보정 이력 기록 (권장 — 감사 추적용)
        </label>
        {!logTx && <div style={{ background: t.amberL, borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 11, color: t.amber, fontWeight: 600 }}>⚠ 이력 없이 수량만 변경됩니다. 추적이 불가능해집니다.</div>}
        <div style={{ display: 'flex', gap: 8 }}><button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, border: `1px solid ${t.border}`, cursor: 'pointer', background: 'transparent', color: t.textM, fontSize: 13 }}>취소</button><button onClick={save} disabled={saving || diff === 0} style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', cursor: saving || diff === 0 ? 'not-allowed' : 'pointer', background: saving || diff === 0 ? t.textL : t.amber, color: '#fff', fontSize: 13, fontWeight: 700 }}>{saving ? '...' : '보정 적용'}</button></div>
      </div>
    </div>
  </div>
}

/* ═══ LOT 관리 모달 ═══ */
function LotModal({ drug: dr, onClose, onSaved }) {
  const { t } = useTheme(); const [lots, setLots] = useState([]); const [ld, setLd] = useState(true); const [msg, setMsg] = useState(null)
  const [nf, setNf] = useState({ lot_no: '', expiry_date: '', quantity: '', supplier: '', memo: '' })
  useEffect(() => { loadLots() }, [])
  async function loadLots() { setLd(true); const { data } = await supabase.from('drug_lots').select('*').eq('drug_code', dr.drug_code).order('expiry_date'); setLots(data || []); setLd(false) }
  async function addLot() { if (!nf.lot_no.trim() || !nf.expiry_date) { setMsg('LOT번호와 유효기한 필수'); return }; const { error } = await supabase.from('drug_lots').insert([{ drug_code: dr.drug_code, lot_no: nf.lot_no.trim(), expiry_date: nf.expiry_date, quantity: Number(nf.quantity) || 0, supplier: nf.supplier, memo: nf.memo, received_date: new Date().toISOString().split('T')[0] }]); if (error) { setMsg(error.message); return }; setMsg('추가 완료'); setNf({ lot_no: '', expiry_date: '', quantity: '', supplier: '', memo: '' }); loadLots(); onSaved?.(); setTimeout(() => setMsg(null), 2000) }
  async function delLot(id) { await supabase.from('drug_lots').delete().eq('id', id); loadLots(); onSaved?.() }
  async function toggleActive(lot) { await supabase.from('drug_lots').update({ is_active: !lot.is_active }).eq('id', lot.id); loadLots() }
  const totalQty = lots.filter(l => l.is_active).reduce((a, l) => a + (l.quantity || 0), 0)
  const ip = { width: '100%', padding: '8px 10px', border: `1px solid ${t.border}`, borderRadius: 6, fontSize: 12, outline: 'none', boxSizing: 'border-box', background: t.bg, color: t.text }
  return <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1002, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
    <div style={{ background: t.cardSolid, borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${t.border}`, boxShadow: t.shadowH }} onClick={e => e.stopPropagation()}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><div style={{ fontSize: 15, fontWeight: 700, color: t.blue }}>LOT 관리</div><div style={{ fontSize: 11, color: t.textM, marginTop: 2 }}>{dr.drug_name} ({dr.drug_code})</div></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 12, color: t.green, fontWeight: 600 }}>활성합계: {totalQty}개</span><button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', cursor: 'pointer', fontSize: 14, color: t.textM }}>✕</button></div>
      </div>
      <div style={{ padding: '16px 20px' }}>
        {msg && <div style={{ background: msg.includes('완료') ? t.greenL : t.redL, borderRadius: 6, padding: '8px 12px', marginBottom: 10, color: msg.includes('완료') ? t.green : t.red, fontSize: 12, fontWeight: 600 }}>{msg}</div>}
        <div style={{ background: t.bg, borderRadius: 10, padding: '14px', marginBottom: 14, border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>새 LOT 추가</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div><label style={{ fontSize: 10, color: t.textM, display: 'block', marginBottom: 3 }}>LOT번호 *</label><input value={nf.lot_no} onChange={e => setNf(p => ({ ...p, lot_no: e.target.value }))} style={ip} /></div>
            <div><label style={{ fontSize: 10, color: t.textM, display: 'block', marginBottom: 3 }}>유효기한 *</label><input type="date" value={nf.expiry_date} onChange={e => setNf(p => ({ ...p, expiry_date: e.target.value }))} style={ip} /></div>
            <div><label style={{ fontSize: 10, color: t.textM, display: 'block', marginBottom: 3 }}>수량</label><input type="number" value={nf.quantity} onChange={e => setNf(p => ({ ...p, quantity: e.target.value }))} style={ip} /></div>
          </div>
          <button onClick={addLot} style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: t.blue, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>LOT 추가</button>
        </div>
        {ld ? <div style={{ textAlign: 'center', padding: 20, color: t.textL }}>로딩...</div> : !lots.length ? <div style={{ textAlign: 'center', padding: 20, color: t.textL, fontSize: 12 }}>등록된 LOT 없음</div> : <div style={{ border: `1px solid ${t.border}`, borderRadius: 8, overflow: 'hidden' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}><thead><tr style={{ background: t.bg }}>{['LOT번호', '유효기한', '수량', 'D-day', '상태', ''].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: t.textM, fontWeight: 600, fontSize: 11 }}>{h}</th>)}</tr></thead><tbody>{lots.map(l => { const days = exD(l.expiry_date); return <tr key={l.id} style={{ borderTop: `1px solid ${t.border}`, opacity: l.is_active ? 1 : .5 }}><td style={{ padding: '8px 10px', fontWeight: 600 }}>{l.lot_no}</td><td style={{ padding: '8px 10px', ...exS(l.expiry_date, t) }}>{l.expiry_date}</td><td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{l.quantity?.toLocaleString()}</td><td style={{ padding: '8px 10px' }}>{days !== null ? <span style={{ fontSize: 10, color: days <= 30 ? t.red : days <= 90 ? t.amber : t.green, fontWeight: 600 }}>D{days <= 0 ? days : '-' + days}</span> : '-'}</td><td style={{ padding: '8px 10px' }}><button onClick={() => toggleActive(l)} style={{ padding: '2px 8px', borderRadius: 4, border: `1px solid ${l.is_active ? t.green : t.textL}`, background: l.is_active ? t.greenL : 'transparent', color: l.is_active ? t.green : t.textL, cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>{l.is_active ? '활성' : '비활성'}</button></td><td style={{ padding: '8px 10px' }}><button onClick={() => delLot(l.id)} style={{ padding: '2px 6px', borderRadius: 4, border: `1px solid ${t.red}`, background: 'transparent', color: t.red, cursor: 'pointer', fontSize: 9 }}>삭제</button></td></tr> })}</tbody></table></div>}
      </div>
    </div>
  </div>
}

/* ═══ 헤더 — 다크 배경 ═══ */
function Header({ menu: m, setMenu: sm }) {
  const { t, dark, toggle } = useTheme()
  const ms = [{ id: 'dashboard', l: '대시보드' }, { id: 'druglist', l: '약품목록' }, { id: 'expiry', l: '유효기한' }, { id: 'stock', l: '재고현황' }, { id: 'narcotic', l: '향정마약' }, { id: 'transaction', l: '입출고' }, { id: 'report', l: '보고서' }]
  return <div className="no-print" style={{ background: t.nav, padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flex: '0 0 auto' }} onClick={() => sm('dashboard')}>
      <div onClick={e => { e.stopPropagation(); sm('register') }} style={{ width: 32, height: 32, borderRadius: 8, background: m === 'register' ? t.navHi + '30' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, cursor: 'pointer', color: t.navHi, border: '1px solid rgba(255,255,255,0.1)' }}>+</div>
      <div><div style={{ fontSize: 15, fontWeight: 700, color: t.navText, letterSpacing: 0.5 }}>씨엔씨재활의학과</div><div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>약품통합관리시스템</div></div>
    </div>
    <div style={{ display: 'flex', gap: 2, flex: '1 1 auto', justifyContent: 'center' }}>{ms.map(x => <button key={x.id} onClick={() => sm(x.id)} style={{ padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: m === x.id ? 700 : 400, background: m === x.id ? t.navHi + '22' : 'transparent', color: m === x.id ? t.navHi : 'rgba(255,255,255,0.55)', border: m === x.id ? `1px solid ${t.navHi}40` : '1px solid transparent', transition: 'all .15s' }}>{x.l}</button>)}</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '0 0 auto' }}>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</span>
      <button onClick={toggle} style={{ width: 38, height: 20, borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: dark ? t.navHi + '30' : 'rgba(255,255,255,0.08)', cursor: 'pointer', position: 'relative', padding: 0 }}><div style={{ width: 16, height: 16, borderRadius: 8, background: dark ? t.navHi : 'rgba(255,255,255,0.4)', position: 'absolute', top: 1, left: dark ? 19 : 1, transition: 'all .2s' }} /></button>
    </div>
  </div>
}

/* ═══ 대시보드 — Bento Grid ═══ */
function Dashboard({ drugs, inv, txns, onNav, onEdit }) {
  const { t } = useTheme(); const { hs, so, SI, TS } = useSort('drug_name')
  const today = new Date(), fmt = d => d.toISOString().split('T')[0], ym = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`, d30 = new Date(today), d90 = new Date(today); d30.setDate(d30.getDate() + 30); d90.setDate(d90.getDate() + 90)
  const active = drugs.filter(d => d.status === '사용')
  const s = { total: drugs.length, active: active.length, stopped: drugs.filter(d => d.status === '중지').length, dormant: drugs.filter(d => d.status === '휴면').length, narc: drugs.filter(d => isN(d)).length, nonIns: drugs.filter(d => d.insurance_type === '비보험' && d.status === '사용').length, shortage: inv.filter(d => d.stock_status === '부족').length, e30: drugs.filter(d => d.expiry_date && d.expiry_date <= fmt(d30) && d.status === '사용').length, e90: drugs.filter(d => d.expiry_date && d.expiry_date > fmt(d30) && d.expiry_date <= fmt(d90) && d.status === '사용').length }
  const totalAmt = active.reduce((a, d) => a + (d.current_qty || 0) * (d.price_unit || 0), 0)
  const mTx = txns.filter(tx => tx.transaction_date?.startsWith(ym))
  const txS = { inC: mTx.filter(x => x.type === '입고').length, inA: mTx.filter(x => x.type === '입고').reduce((a, x) => a + (x.total_amount || 0), 0), outC: mTx.filter(x => x.type === '출고').length, outA: mTx.filter(x => x.type === '출고').reduce((a, x) => a + (x.total_amount || 0), 0), retC: mTx.filter(x => x.type === '반품').length, retA: mTx.filter(x => x.type === '반품').reduce((a, x) => a + (x.total_amount || 0), 0), dspC: mTx.filter(x => x.type === '폐기').length, dspA: mTx.filter(x => x.type === '폐기').reduce((a, x) => a + (x.total_amount || 0), 0), dspQ: mTx.filter(x => x.type === '폐기').reduce((a, x) => a + (x.quantity || 0), 0) }
  txS.lossT = txS.retC + txS.dspC; txS.lossA = txS.retA + txS.dspA
  const catData = CATS.map(cat => { const items = active.filter(d => d.category === cat); return { cat, total: items.length, qty: items.reduce((a, d) => a + (d.current_qty || 0), 0), expSoon: items.filter(d => { const x = exD(d.expiry_date); return x !== null && x <= 90 }).length } }).filter(c => c.total > 0)
  const catC = { '경구제': t.accent, '주사제': t.green, '외용제': t.blue, '수액제': t.mint || '#92C8E0', '영양제': '#A8CF5C', '의약외품': t.coral || t.amber }
  const sorted = so(active.slice(0, 15))
  const tc = bc => ({ background: t.card, borderRadius: 14, padding: '20px', border: `1px solid ${t.border}`, borderTop: `3px solid ${bc}`, cursor: 'pointer', transition: 'all .2s', boxShadow: t.shadow })
  const hv = e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = t.shadowH }
  const hx = e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = t.shadow }
  const sT = (icon, title) => <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12, paddingBottom: 8, borderBottom: `2px solid ${t.accent}`, display: 'flex', alignItems: 'center', gap: 6 }}><span>{icon}</span>{title}</div>
  const sR = (label, value, color, unit) => <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${t.border}` }}><span style={{ fontSize: 12, color: t.textM }}>{label}</span><span style={{ fontSize: 13, fontWeight: 700, color: color || t.text }}>{typeof value === 'number' ? value.toLocaleString() : value}{unit || ''}</span></div>
  return <div style={{ padding: '20px 24px' }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
      {[{ l: '전체 약품', v: s.total, c: t.accent, nav: { menu: 'druglist', status: STATS } }, { l: '사용', v: s.active, c: t.green, nav: { menu: 'druglist', status: ['사용'] } }, { l: '중지', v: s.stopped, c: t.textL, nav: { menu: 'druglist', status: ['중지'] } }, { l: '향정마약', v: s.narc, c: t.purple, nav: { menu: 'narcotic' } }].map((c, i) => <div key={i} onClick={() => onNav(c.nav)} style={tc(c.c)} onMouseEnter={hv} onMouseLeave={hx}><div style={{ fontSize: 12, color: t.textM, fontWeight: 500, marginBottom: 8 }}>{c.l}</div><div style={{ fontSize: 34, fontWeight: 800, color: c.c, letterSpacing: -1 }}>{c.v}</div></div>)}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
      {[{ l: '비보험', v: s.nonIns, c: t.blue }, { l: '재고부족', v: s.shortage, c: t.red, nav: { menu: 'stock', filter: '부족' } }, { l: '유효기한 ≤30일', v: s.e30, c: t.red, nav: { menu: 'expiry', focus: 'urgent' } }, { l: '유효기한 ≤90일', v: s.e90, c: t.amber, nav: { menu: 'expiry', focus: 'warning' } }].map((c, i) => <div key={i} onClick={() => c.nav && onNav(c.nav)} style={{ background: t.card, borderRadius: 12, padding: '14px 18px', border: `1px solid ${t.border}`, cursor: c.nav ? 'pointer' : 'default', transition: 'all .15s', boxShadow: t.shadow }} onMouseEnter={hv} onMouseLeave={hx}><div style={{ fontSize: 11, color: t.textM }}>{c.l}</div><div style={{ fontSize: 26, fontWeight: 700, color: c.c, marginTop: 4 }}>{c.v}</div></div>)}
    </div>
    {s.e30 > 0 && <div onClick={() => onNav({ menu: 'expiry', focus: 'urgent' })} style={{ background: t.redL, border: `1px solid ${t.red}30`, borderRadius: 12, padding: '12px 18px', marginBottom: 14, color: t.red, fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: t.shadow }}>⚠ 유효기한 30일 이내 약품 <strong>{s.e30}개</strong> — 즉시 확인 필요</div>}
    {/* ★ 3-Column: 입출고 + 반품/폐기 + 재고총괄 — 클릭 → 해당 페이지 이동 */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
      <div onClick={() => onNav({ menu: 'transaction' })} style={{ background: t.card, borderRadius: 14, padding: '18px 22px', border: `1px solid ${t.border}`, boxShadow: t.shadow, cursor: 'pointer', transition: 'all .15s' }} onMouseEnter={hv} onMouseLeave={hx}>
        {sT('▶◀', '당월 입출고')}
        {sR('입고 건수', txS.inC, t.green, '건')}{sR('입고 금액', txS.inA, t.green, '원')}{sR('출고 건수', txS.outC, t.blue, '건')}{sR('출고 금액', txS.outA, t.blue, '원')}{sR('순 입출고', txS.inA - txS.outA, txS.inA >= txS.outA ? t.green : t.red, '원')}
      </div>
      <div onClick={() => onNav({ menu: 'report' })} style={{ background: t.card, borderRadius: 14, padding: '18px 22px', border: `1px solid ${t.border}`, boxShadow: t.shadow, cursor: 'pointer', transition: 'all .15s' }} onMouseEnter={hv} onMouseLeave={hx}>
        {sT('▲', '반품/폐기 현황')}
        {sR('반품 건수', txS.retC, t.amber, '건')}{sR('반품 금액', txS.retA, t.amber, '원')}{sR('폐기 건수', txS.dspC, t.red, '건')}{sR('폐기 금액', txS.dspA, t.red, '원')}{sR('폐기 수량', txS.dspQ, t.red, '개')}
        <div style={{ marginTop: 8, padding: '8px 12px', background: t.redL, borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 12, fontWeight: 700, color: t.red }}>손실 합계</span><span style={{ fontSize: 14, fontWeight: 800, color: t.red }}>{txS.lossT}건 / ₩{txS.lossA.toLocaleString()}</span></div>
      </div>
      <div onClick={() => onNav({ menu: 'stock' })} style={{ background: t.card, borderRadius: 14, padding: '18px 22px', border: `1px solid ${t.border}`, boxShadow: t.shadow, cursor: 'pointer', transition: 'all .15s' }} onMouseEnter={hv} onMouseLeave={hx}>
        {sT('■', '재고 총괄')}
        {sR('관리 품목수', s.total, t.accent, '개')}{sR('현재고 총금액', totalAmt, t.accent, '원')}
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${t.border}` }}><div style={{ fontSize: 11, color: t.textM, marginBottom: 6 }}>📋 사용상태</div><div style={{ display: 'flex', gap: 8 }}>{[{ l: '사용', v: s.active, c: t.green, nav: { menu: 'druglist', status: ['사용'] } }, { l: '휴면', v: s.dormant, c: t.amber, nav: { menu: 'druglist', status: ['휴면'] } }, { l: '중지', v: s.stopped, c: t.textL, nav: { menu: 'druglist', status: ['중지'] } }].map((x, i) => <div key={i} onClick={e => { e.stopPropagation(); onNav(x.nav) }} style={{ flex: 1, textAlign: 'center', padding: '6px', background: t.bg, borderRadius: 8, cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = t.border} onMouseLeave={e => e.currentTarget.style.background = t.bg}><div style={{ fontSize: 9, color: t.textL }}>{x.l}</div><div style={{ fontSize: 16, fontWeight: 700, color: x.c }}>{x.v}</div></div>)}</div></div>
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.border}` }}><div style={{ fontSize: 11, color: t.textM, marginBottom: 6 }}>📦 재고현황</div><div style={{ display: 'flex', gap: 8 }}>{[{ l: '부족', v: s.shortage, c: t.red, nav: { menu: 'stock', filter: '부족' } }, { l: '정상', v: s.active - s.shortage, c: t.green, nav: { menu: 'stock', filter: '정상' } }].map((x, i) => <div key={i} onClick={e => { e.stopPropagation(); onNav(x.nav) }} style={{ flex: 1, textAlign: 'center', padding: '6px', background: t.bg, borderRadius: 8, cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = t.border} onMouseLeave={e => e.currentTarget.style.background = t.bg}><div style={{ fontSize: 9, color: t.textL }}>{x.l}</div><div style={{ fontSize: 16, fontWeight: 700, color: x.c }}>{x.v}</div></div>)}</div></div>
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 18 }}>
      {catData.map(c => { const cc = catC[c.cat] || t.accent; return <div key={c.cat} onClick={() => onNav({ menu: 'druglist', status: ['사용'] })} style={{ background: t.card, borderRadius: 14, padding: '18px 22px', border: `1px solid ${t.border}`, borderLeft: `4px solid ${cc}`, cursor: 'pointer', transition: 'all .15s', boxShadow: t.shadow }} onMouseEnter={hv} onMouseLeave={hx}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}><span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{c.cat}</span><span style={{ fontSize: 14, fontWeight: 700, color: cc }}>{c.total}개</span></div><div style={{ display: 'flex', gap: 20, alignItems: 'baseline' }}><div><div style={{ fontSize: 10, color: t.textL, marginBottom: 2 }}>갯수</div><div style={{ fontSize: 22, fontWeight: 800, color: cc }}>{c.qty.toLocaleString()}</div></div>{c.expSoon > 0 && <div><div style={{ fontSize: 10, color: t.textL, marginBottom: 2 }}>유효기한 주의</div><div style={{ fontSize: 22, fontWeight: 800, color: t.amber }}>{c.expSoon}</div></div>}</div><div style={{ height: 4, background: t.border, borderRadius: 2, marginTop: 12 }}><div style={{ height: '100%', background: cc, borderRadius: 2, width: `${Math.min(c.total / Math.max(s.active, 1) * 100, 100)}%`, opacity: 0.5 }} /></div></div> })}
    </div>
    <div style={{ background: t.card, borderRadius: 14, border: `1px solid ${t.border}`, overflow: 'hidden', boxShadow: t.shadow }}>
      <div style={{ padding: '14px 22px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: t.accentL }}><span style={{ fontWeight: 700, fontSize: 14, color: t.accent }}>사용 중인 약품</span><span style={{ fontSize: 13, fontWeight: 700, color: t.accent }}>{s.active}개</span></div>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr>{[['drug_code', '약품코드'], ['drug_name', '약품명'], ['category', '구분'], ['current_qty', '현재고'], ['expiry_date', '유효기한'], ['status', '상태']].map(([k, h]) => <th key={k} style={TS(k)} onClick={() => hs(k)}>{h}<SI col={k} /></th>)}</tr></thead>
        <tbody>{sorted.map((d, i) => <tr key={i} style={{ borderBottom: `1px solid ${t.border}` }} onMouseEnter={e => e.currentTarget.style.background = t.glass} onMouseLeave={e => e.currentTarget.style.background = ''}><td style={{ padding: '9px 12px', fontSize: 10, color: t.textM, textAlign: 'left' }}>{d.drug_code}<NT d={d} /></td><CN drug={d} onEdit={onEdit} /><td style={{ padding: '9px 12px', color: t.textM, fontSize: 11 }}>{d.category}</td><td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600, color: d.current_qty === 0 ? t.red : t.text }}>{d.current_qty?.toLocaleString()}</td><td style={{ padding: '9px 12px', fontSize: 11, ...exS(d.expiry_date, t) }}>{d.expiry_date || '-'}</td><td style={{ padding: '9px 12px' }}><SB s={d.status} /></td></tr>)}</tbody>
      </table></div>
    </div><Ft />
  </div>
}

/* ═══ 약품목록 — 컬럼 가시성 토글 ═══ */
const DRUG_COLS = [
  { key: 'drug_code', label: '약품코드', default: true, align: 'left' }, { key: 'drug_name', label: '약품명', default: true, align: 'left' },
  { key: 'category', label: '구분', default: true, align: 'left' },
  { key: 'ingredient_kr', label: '성분명(한글)', default: true, align: 'left' },
  { key: 'ingredient_en', label: '성분명(영문)', default: true, align: 'left' },
  { key: 'efficacy', label: '효능', default: false, align: 'left' },
  { key: 'manufacturer', label: '제조사', default: true, align: 'left' }, { key: 'specification', label: '규격', default: false, align: 'center' },
  { key: 'unit', label: '단위', default: false, align: 'center' }, { key: 'price_unit', label: '단가', default: true, align: 'right' },
  { key: 'current_qty', label: '현재고', default: true, align: 'right' }, { key: 'insurance_type', label: '보험', default: true, align: 'center' },
  { key: 'expiry_date', label: '유효기한', default: true, align: 'left' }, { key: 'storage_method', label: '보관', default: false, align: 'center' },
  { key: 'status', label: '상태', default: true, align: 'center' },
]

function DrugList({ drugs, navFilter: nf, onEdit }) {
  const { t } = useTheme(); const [search, setSearch] = useState(''); const [cats, setCats] = useState(CATS); const [stats, setStats] = useState(nf?.status || ['사용']); const [narcOnly, setNarcOnly] = useState(false); const [insF, setInsF] = useState(nf?.insType || '전체'); const [page, setPage] = useState(1); const [visCols, setVisCols] = useState(DRUG_COLS.filter(c => c.default).map(c => c.key))
  const { hs, so, SI, TS } = useSort('drug_name')
  useEffect(() => { if (nf?.status) setStats(Array.isArray(nf.status) ? nf.status : [nf.status]); if (nf?.narcotic) setNarcOnly(true); else setNarcOnly(false); if (nf?.insType) setInsF(nf.insType); else setInsF('전체'); setPage(1) }, [nf])
  const filtered = so(drugs.filter(d => { if (narcOnly && !isN(d)) return false; if (!stats.includes(d.status)) return false; if (!cats.includes(d.category)) return false; if (insF !== '전체' && (d.insurance_type || '보험') !== insF) return false; if (search.trim()) { const q = search.trim().toLowerCase(); return d.drug_name?.toLowerCase().includes(q) || d.drug_code?.toLowerCase().includes(q) || d.ingredient_kr?.toLowerCase().includes(q) || d.manufacturer?.toLowerCase().includes(q) }; return true }))
  const tp = Math.ceil(filtered.length / PP), paged = filtered.slice((page - 1) * PP, page * PP); const activeCols = DRUG_COLS.filter(c => visCols.includes(c.key))
  function dl() { const ws = XLSX.utils.json_to_sheet(filtered.map(d => { const o = {}; DRUG_COLS.forEach(c => { o[c.label] = d[c.key] || '' }); return o })); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, '약품'); XLSX.writeFile(wb, `약품목록_${new Date().toISOString().split('T')[0]}.xlsx`) }
  function cellVal(d, col) {
    if (col.key === 'drug_code') return <><span style={{ fontSize: 10, color: t.textM }}>{d.drug_code}</span><NT d={d} /></>
    if (col.key === 'drug_name') return <CN drug={d} onEdit={onEdit} />
    if (col.key === 'ingredient_kr') return <span title={d.ingredient_kr || ''} style={{ color: t.textM, fontSize: 11, maxWidth: 140, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{d.ingredient_kr || '-'}</span>
    if (col.key === 'ingredient_en') return <span title={d.ingredient_en || ''} style={{ color: t.textL, fontSize: 10, maxWidth: 140, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle', fontStyle: 'italic' }}>{d.ingredient_en || '-'}</span>
    if (col.key === 'current_qty') return <span style={{ fontWeight: 600, color: d.current_qty === 0 ? t.red : t.text }}>{d.current_qty?.toLocaleString()}</span>
    if (col.key === 'price_unit') return d.price_unit ? d.price_unit.toLocaleString() + '원' : '-'
    if (col.key === 'insurance_type') return (d.insurance_type || '보험') === '비보험' ? <Bd bg={t.blueL} color={t.blue}>비보험</Bd> : <span style={{ fontSize: 10, color: t.textL }}>보험</span>
    if (col.key === 'expiry_date') return <span style={exS(d.expiry_date, t)}>{d.expiry_date || '-'}</span>
    if (col.key === 'status') return <SB s={d.status} />
    return <span title={d[col.key] || ''} style={{ color: t.textM, fontSize: 11, maxWidth: 120, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{d[col.key] || '-'}</span>
  }
  return <div style={{ padding: '20px 24px' }}>
    <div className="no-print" style={{ background: t.card, borderRadius: 14, border: `1px solid ${t.border}`, padding: '16px 18px', marginBottom: 12, boxShadow: t.shadow }}>
      <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="약품명, 코드, 성분명, 제조사 검색..." style={{ width: '100%', padding: '10px 14px', border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 13, marginBottom: 12, outline: 'none', boxSizing: 'border-box', background: t.bg, color: t.text }} onFocus={e => e.target.style.borderColor = t.accent} onBlur={e => e.target.style.borderColor = t.border} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <MP items={CATS} selected={cats} onChange={v => { setCats(v); setPage(1) }} color={t.accent} label="구분" />
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}><MP items={STATS} selected={stats} onChange={v => { setStats(v); setPage(1) }} color={t.green} label="상태" /><div style={{ width: 1, height: 16, background: t.border }} /><button onClick={() => { setNarcOnly(!narcOnly); setPage(1) }} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${narcOnly ? t.purple : t.border}`, cursor: 'pointer', fontSize: 11, fontWeight: 600, background: narcOnly ? t.purpleL : 'transparent', color: narcOnly ? t.purple : t.textM }}>향정마약</button></div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span style={{ fontSize: 10, color: t.textL, fontWeight: 600 }}>보험</span>{['전체', '보험', '비보험'].map(x => <button key={x} onClick={() => { setInsF(x); setPage(1) }} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${insF === x ? t.blue : t.border}`, cursor: 'pointer', fontSize: 11, fontWeight: 600, background: insF === x ? t.blueL : 'transparent', color: insF === x ? t.blue : t.textM }}>{x}</button>)}<div style={{ flex: 1 }} /><ColToggle cols={DRUG_COLS} visible={visCols} setVisible={setVisCols} /><button onClick={dl} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${t.green}`, background: t.greenL, color: t.green, cursor: 'pointer', fontSize: 11, fontWeight: 600, marginLeft: 4 }}>엑셀 다운로드</button></div>
      </div>
    </div>
    <div style={{ background: t.card, borderRadius: 14, border: `1px solid ${t.border}`, overflow: 'hidden', boxShadow: t.shadow }}>
      <div style={{ padding: '10px 18px', borderBottom: `1px solid ${t.border}`, fontSize: 12, color: t.textM, display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}><span>전체 {drugs.length}개 · 결과 <strong style={{ color: t.accent }}>{filtered.length}개</strong></span><span style={{ fontSize: 10, color: t.textL }}>약품명 클릭 → 수정</span></div>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr>{activeCols.map(c => <th key={c.key} style={{ ...TS(c.key), textAlign: c.align }} onClick={() => hs(c.key)}>{c.label}<SI col={c.key} /></th>)}</tr></thead>
        <tbody>{!paged.length ? <tr><td colSpan={activeCols.length} style={{ padding: 40, textAlign: 'center', color: t.textL }}>검색 결과 없음</td></tr>
          : paged.map((d, i) => <tr key={i} style={{ borderBottom: `1px solid ${t.border}` }} onMouseEnter={e => e.currentTarget.style.background = t.glass} onMouseLeave={e => e.currentTarget.style.background = ''}>
            {activeCols.map(c => c.key === 'drug_name' ? <CN key={c.key} drug={d} onEdit={onEdit} /> : <td key={c.key} style={{ padding: '8px 12px', textAlign: c.align, color: t.textM, fontSize: c.key === 'drug_code' ? 10 : 11 }}>{cellVal(d, c)}</td>)}
          </tr>)}</tbody>
      </table></div>
      <Pg page={page} setPage={setPage} tp={tp} fl={filtered} pp={PP} />
    </div><Ft />
  </div>
}
/* ═══ 유효기한 — 칩 클릭 라우팅 ═══ */
function ExpiryAlert({drugs,onEdit,focusLevel,onReload}){
  const{t}=useTheme();const[cats,setCats]=useState(CATS);const[stats,setStats]=useState(['사용']);const[aLv,setALv]=useState(focusLevel||null)
  const[editRow,setEditRow]=useState(null);const[editVal,setEditVal]=useState({})
  const fd=drugs.filter(d=>cats.includes(d.category)&&stats.includes(d.status))
  const unusedDays=d=>{if(!d.last_used_date)return null;return Math.floor((new Date()-new Date(d.last_used_date))/864e5)}
  const isUnused=d=>{const days=unusedDays(d);return days!==null&&days>=365}
  const g={urgent:fd.filter(d=>{const x=exD(d.expiry_date);return x!==null&&x<=30}),warning:fd.filter(d=>{const x=exD(d.expiry_date);return x!==null&&x>30&&x<=90}),notice:fd.filter(d=>{const x=exD(d.expiry_date);return x!==null&&x>90&&x<=180}),narcotic:drugs.filter(d=>{const x=exD(d.expiry_date);return x!==null&&x<=180&&isN(d)&&cats.includes(d.category)}),unused:fd.filter(d=>isUnused(d))}
  useEffect(()=>{if(focusLevel)setALv(focusLevel)},[focusLevel])
  async function saveUsage(d){
    const ud={};if(editVal.last_used_dept!==undefined)ud.last_used_dept=editVal.last_used_dept;if(editVal.last_used_date!==undefined)ud.last_used_date=editVal.last_used_date||null
    if(Object.keys(ud).length){await supabase.from('drugs').update(ud).eq('drug_code',d.drug_code);onReload?.()};setEditRow(null);setEditVal({})
  }
  function dlE(){const all=[...g.urgent,...g.warning,...g.notice,...g.narcotic,...g.unused];const ws=XLSX.utils.json_to_sheet(all.map(d=>({약품코드:d.drug_code,약품명:d.drug_name,구분:d.category,현재고:d.current_qty||0,유효기한:d.expiry_date||'',남은일수:exD(d.expiry_date),최종사용과:d.last_used_dept||'',최종사용일:d.last_used_date||'',미사용기간:unusedDays(d)||'',미사용알림:isUnused(d)?'⚠1년이상':'',향정:getNT(d)})));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'유효기한');XLSX.writeFile(wb,`유효기한_${new Date().toISOString().split('T')[0]}.xlsx`)}
  const lvs=[{k:'urgent',l:'긴급',sub:'≤30일',c:t.red},{k:'warning',l:'주의',sub:'31~90일',c:t.amber},{k:'notice',l:'확인',sub:'91~180일',c:t.blue},{k:'narcotic',l:'향정마약',sub:'≤180일',c:t.purple},{k:'unused',l:'미사용',sub:'1년 이상',c:'#B71C1C'}]
  const ip2={padding:'4px 6px',border:`1px solid ${t.border}`,borderRadius:4,fontSize:10,outline:'none',background:t.bg,color:t.text,width:80}
  function ET({items,color}){const{hs,so,SI,TS}=useSort('expiry_date');const sorted=so(items);if(!sorted.length)return<div style={{padding:16,textAlign:'center',color:t.textL,fontSize:12}}>해당 없음</div>;return<div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}><thead><tr>{[['drug_code','코드'],['drug_name','약품명'],['category','구분'],['current_qty','현재고'],['expiry_date','유효기한'],['','D-day'],['last_used_dept','최종사용과'],['last_used_date','최종사용일'],['','미사용']].map(([k,h])=><th key={h} style={k?TS(k):{padding:'8px 10px',textAlign:'left',color:t.textM,fontWeight:600,borderBottom:`1px solid ${t.border}`,fontSize:10}} onClick={()=>k&&hs(k)}>{h}{k&&<SI col={k}/>}</th>)}</tr></thead>
    <tbody>{sorted.map((d,i)=>{const days=exD(d.expiry_date);const uDays=unusedDays(d);const isEd=editRow===d.drug_code;const uu=isUnused(d)
      return<tr key={i} style={{borderBottom:`1px solid ${t.border}`,background:uu?t.redL+'60':''}} onMouseEnter={e=>{if(!uu)e.currentTarget.style.background=t.glass}} onMouseLeave={e=>{if(!uu)e.currentTarget.style.background=''}}>
        <td style={{padding:'6px 10px',fontSize:10,color:t.textM}}>{d.drug_code}<NT d={d}/></td>
        <CN drug={d} onEdit={onEdit}/>
        <td style={{padding:'6px 10px',color:t.textM,fontSize:11}}>{d.category}</td>
        <td style={{padding:'6px 10px',textAlign:'right',fontWeight:600}}>{d.current_qty?.toLocaleString()}</td>
        <td style={{padding:'6px 10px',color,fontWeight:600,fontSize:11}}>{d.expiry_date}</td>
        <td style={{padding:'6px 10px'}}><span style={{background:color+'18',color,fontWeight:700,padding:'2px 8px',borderRadius:6,fontSize:10}}>D{days<=0?days:'-'+days}</span></td>
        <td style={{padding:'6px 10px',fontSize:10}}>{isEd?<select value={editVal.last_used_dept??d.last_used_dept??''} onChange={e=>setEditVal(p=>({...p,last_used_dept:e.target.value}))} style={{...ip2,width:90}}><option value="">선택</option><option>가정의학과</option><option>재활의학과1</option><option>신경과</option><option>기타</option></select>:<span style={{color:t.textM,cursor:'pointer'}} onClick={()=>{setEditRow(d.drug_code);setEditVal({last_used_dept:d.last_used_dept||'',last_used_date:d.last_used_date||''})}}>{d.last_used_dept?<span style={{background:t.accentL,color:t.accent,padding:'1px 8px',borderRadius:6,fontSize:9,fontWeight:600}}>{d.last_used_dept}</span>:<span style={{color:t.textL}}>클릭입력</span>}</span>}</td>
        <td style={{padding:'6px 10px',fontSize:10}}>{isEd?<><input type="date" value={editVal.last_used_date??d.last_used_date??''} onChange={e=>setEditVal(p=>({...p,last_used_date:e.target.value}))} style={{...ip2,width:110}}/><button onClick={()=>saveUsage(d)} style={{marginLeft:3,padding:'2px 6px',borderRadius:4,border:`1px solid ${t.green}`,background:t.greenL,color:t.green,cursor:'pointer',fontSize:9}}>저장</button></>:<span style={{color:t.textM,cursor:'pointer'}} onClick={()=>{setEditRow(d.drug_code);setEditVal({last_used_dept:d.last_used_dept||'',last_used_date:d.last_used_date||''})}}>{d.last_used_date||<span style={{color:t.textL}}>클릭입력</span>}</span>}</td>
        <td style={{padding:'6px 10px'}}>{uu?<span style={{background:t.red,color:'#fff',padding:'2px 8px',borderRadius:6,fontSize:9,fontWeight:700}}>⚠ {Math.floor(uDays/30)}개월</span>:uDays!==null?<span style={{fontSize:9,color:t.textL}}>{uDays}일</span>:''}</td>
      </tr>})}</tbody></table></div>}
  const show=aLv?lvs.filter(l=>l.k===aLv):lvs.filter(l=>l.k!=='unused'||g.unused.length>0)
  return<div style={{padding:'20px 24px'}}>
    <div className="no-print" style={{background:t.card,borderRadius:12,border:`1px solid ${t.border}`,padding:'10px 16px',marginBottom:12,display:'flex',alignItems:'center',flexWrap:'wrap',gap:6}}>
      <MP items={CATS} selected={cats} onChange={setCats} color={t.accent} label="구분"/><div style={{width:1,height:16,background:t.border}}/><MP items={STATS} selected={stats} onChange={setStats} color={t.green} label="상태"/>
      <div style={{flex:1}}/><button onClick={dlE} style={{padding:'6px 14px',borderRadius:6,border:`1px solid ${t.green}`,background:t.greenL,color:t.green,cursor:'pointer',fontSize:11,fontWeight:600}}>엑셀 다운로드</button>
    </div>
    <div style={{display:'grid',gridTemplateColumns:`repeat(${g.unused.length>0?5:4},1fr)`,gap:8,marginBottom:14}}>{(g.unused.length>0?lvs:lvs.slice(0,4)).map(l=><div key={l.k} onClick={()=>setALv(aLv===l.k?null:l.k)} style={{background:t.card,border:`1px solid ${aLv===l.k?l.c:t.border}`,borderRadius:12,padding:'14px 16px',cursor:'pointer',transition:'all .15s',boxShadow:aLv===l.k?`0 0 12px ${l.c}15`:'none'}} onMouseEnter={e=>e.currentTarget.style.borderColor=l.c} onMouseLeave={e=>{if(aLv!==l.k)e.currentTarget.style.borderColor=t.border}}><div style={{fontSize:12,color:l.c,fontWeight:700}}>{l.l}</div><div style={{fontSize:28,fontWeight:700,color:l.c,marginTop:4}}>{g[l.k].length}</div><div style={{fontSize:10,color:t.textM,marginTop:2}}>{l.sub}</div></div>)}</div>
    {aLv&&<button className="no-print" onClick={()=>setALv(null)} style={{padding:'5px 14px',borderRadius:6,border:`1px solid ${t.border}`,background:t.card,color:t.textM,cursor:'pointer',fontSize:11,marginBottom:8}}>← 전체 보기</button>}
    {show.map(l=><div key={l.k} style={{background:t.card,borderRadius:12,border:`1px solid ${t.border}`,overflow:'hidden',marginBottom:12}}><div style={{padding:'12px 18px',borderBottom:`1px solid ${t.border}`,display:'flex',alignItems:'center',gap:8,background:l.c+'08'}}><span style={{fontWeight:700,fontSize:13,color:l.c}}>{l.l}</span><span style={{fontSize:11,color:t.textM}}>{l.sub}</span><span style={{marginLeft:'auto',background:l.c,color:'#fff',borderRadius:8,padding:'2px 12px',fontSize:11,fontWeight:700}}>{g[l.k].length}</span></div><ET items={g[l.k]} color={l.c}/></div>)}
    <Ft/>
  </div>
}

/* ═══ 재고현황 — ★ 사용량 엑셀 업로드 추가 ═══ */
function StockStatus({drugs,inv,navFilter:nf,onEdit,onAdjust,onReload}){
  const[filter,setFilter]=useState(nf?.filter||'전체');const[cats,setCats]=useState(CATS);const[stats,setStats]=useState(['사용']);const[search,setSearch]=useState('');const[page,setPage]=useState(1);const{hs,so,SI,TS}=useSort('drug_name')
  const[uMsg,setUMsg]=useState(null);const uRef=useRef()
  useEffect(()=>{if(nf?.filter){setFilter(nf.filter);setPage(1)}},[nf])
  const im={};inv.forEach(i=>{im[i.drug_code]=i});const merged=drugs.filter(d=>stats.includes(d.status)).map(d=>{const iv=im[d.drug_code]||{};const q=d.current_qty||0,sf=iv.safety_stock||d.safety_stock||0,mx=iv.max_stock||d.max_stock||0;let st='정상';if(q===0)st='재고없음';else if(sf>0&&q<sf)st='부족';else if(mx>0&&q>mx)st='과잉';return{...d,safety_stock:sf,max_stock:mx,monthly_avg:iv.monthly_avg||d.monthly_avg||0,stockStatus:st}})
  const sg={전체:merged.length,부족:merged.filter(d=>d.stockStatus==='부족').length,재고없음:merged.filter(d=>d.stockStatus==='재고없음').length,정상:merged.filter(d=>d.stockStatus==='정상').length,과잉:merged.filter(d=>d.stockStatus==='과잉').length}
  const filtered=so(merged.filter(d=>{if(filter!=='전체'&&d.stockStatus!==filter)return false;if(!cats.includes(d.category))return false;if(search.trim()){const q=search.trim().toLowerCase();return d.drug_name?.toLowerCase().includes(q)||d.drug_code?.toLowerCase().includes(q)};return true}));const tp=Math.ceil(filtered.length/PP),paged=filtered.slice((page-1)*PP,page*PP)
  const sc=s=>s==='부족'||s==='재고없음'?t.red:s==='과잉'?t.amber:t.green
  function dl(){const ws=XLSX.utils.json_to_sheet(filtered.map(d=>({약품코드:d.drug_code,약품명:d.drug_name,구분:d.category,현재고:d.current_qty,안전재고:d.safety_stock,최대재고:d.max_stock,월평균:d.monthly_avg,사용상태:d.status,재고상태:d.stockStatus})));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'재고');XLSX.writeFile(wb,`재고_${new Date().toISOString().split('T')[0]}.xlsx`)}
  async function uploadUsage(e){
    const file=e.target.files[0];if(!file)return;setUMsg('업로드 중...')
    const reader=new FileReader();reader.onload=async ev=>{
      try{const wb=XLSX.read(ev.target.result,{type:'array'});const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''})
      let ok=0,fail=0
      for(const r of rows){
        const code=String(r['약품코드']||r['drug_code']||'').trim();if(!code)continue
        const ud={};const py=Number(r['전년사용량']||r['전년도사용량']||r['prev_year_usage']||0);const r3=Number(r['최근3개월사용량']||r['최근3개월']||r['recent_3m_usage']||0);const sf=Number(r['안전재고']||r['safety_stock']||0);const mx=Number(r['최대재고']||r['max_stock']||0)
        if(py)ud.prev_year_usage=py;if(r3)ud.recent_3m_usage=r3;if(sf)ud.safety_stock=sf;if(mx)ud.max_stock=mx
        if(py||r3)ud.monthly_avg=Math.round((r3||py/4)/3)
        if(Object.keys(ud).length){const{error}=await supabase.from('drugs').update(ud).eq('drug_code',code);if(error)fail++;else ok++}
      }
      setUMsg(`완료! ${ok}건 업데이트, ${fail}건 실패`);onReload?.();setTimeout(()=>setUMsg(null),4000)
      }catch(err){setUMsg('오류: '+err.message)}
    };reader.readAsArrayBuffer(file);e.target.value=''
  }
  function dlUsageTemplate(){const ws=XLSX.utils.aoa_to_sheet([['약품코드','약품명(참고용)','전년사용량','최근3개월사용량','안전재고','최대재고'],['SGBRONNC10','가바로닌캡슐100mg',1592,974,488,975],['GRD2','게리드정2밀리그램',330,105,71,141]]);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'사용량');XLSX.writeFile(wb,'사용량_업로드_양식.xlsx')}
  return<div style={{padding:'20px 24px'}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8,marginBottom:14}}>{[{k:'전체',c:t.text},{k:'부족',c:t.red},{k:'재고없음',c:t.red},{k:'정상',c:t.green},{k:'과잉',c:t.amber}].map(f2=><div key={f2.k} onClick={()=>{setFilter(f2.k);setPage(1)}} style={{background:filter===f2.k?f2.c+'15':t.card,borderRadius:12,padding:'12px 16px',border:`1px solid ${filter===f2.k?f2.c:t.border}`,cursor:'pointer',backdropFilter:'blur(12px)'}}><div style={{fontSize:10,color:t.textM}}>{f2.k}</div><div style={{fontSize:24,fontWeight:700,color:f2.c}}>{sg[f2.k]}</div></div>)}</div>
    {uMsg&&<div style={{background:uMsg.includes('완료')?t.greenL:uMsg.includes('오류')?t.redL:t.blueL,border:`1px solid ${uMsg.includes('완료')?t.green:uMsg.includes('오류')?t.red:t.blue}`,borderRadius:8,padding:'10px 14px',marginBottom:10,color:uMsg.includes('완료')?t.green:uMsg.includes('오류')?t.red:t.blue,fontSize:12,fontWeight:600}}>{uMsg}</div>}
    <div className="no-print" style={{background:t.card,borderRadius:12,border:`1px solid ${t.border}`,padding:'12px 16px',marginBottom:12,display:'flex',flexDirection:'column',gap:8,backdropFilter:'blur(12px)'}}>
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} placeholder="검색..." style={{flex:1,minWidth:120,padding:'8px 12px',border:`1px solid ${t.border}`,borderRadius:8,fontSize:12,outline:'none',background:t.bg,color:t.text}}/>
        <button onClick={dl} style={{padding:'6px 14px',borderRadius:8,border:`1px solid ${t.green}`,background:t.greenL,color:t.green,cursor:'pointer',fontSize:11,fontWeight:600}}>엑셀</button>
        <button onClick={dlUsageTemplate} style={{padding:'6px 14px',borderRadius:8,border:`1px solid ${t.blue}`,background:t.blueL,color:t.blue,cursor:'pointer',fontSize:11,fontWeight:600}}>사용량 양식</button>
        <button onClick={()=>uRef.current.click()} style={{padding:'6px 14px',borderRadius:8,border:`1px solid ${t.amber}`,background:t.amberL,color:t.amber,cursor:'pointer',fontSize:11,fontWeight:600}}>사용량 업로드</button>
        <input ref={uRef} type="file" accept=".xlsx,.xls" onChange={uploadUsage} style={{display:'none'}}/>
      </div>
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        <MP items={CATS} selected={cats} onChange={v=>{setCats(v);setPage(1)}} color={t.purple} label="구분"/>
        <div style={{width:1,height:16,background:t.border}}/>
        <MP items={STATS} selected={stats} onChange={v=>{setStats(v);setPage(1)}} color={t.green} label="상태"/>
      </div>
    </div>
    <div style={{background:t.card,borderRadius:12,border:`1px solid ${t.border}`,overflow:'hidden',backdropFilter:'blur(12px)'}}>
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
        <thead><tr>{[['drug_code','약품코드'],['drug_name','약품명'],['category','구분'],['current_qty','현재고'],['safety_stock','안전재고'],['max_stock','최대재고'],['monthly_avg','월평균'],['status','사용상태'],['stockStatus','재고상태'],['expiry_date','유효기한'],['','보정']].map(([k,h])=><th key={h} style={k?TS(k):{padding:'8px 10px',textAlign:'center',color:t.textM,fontWeight:600,borderBottom:`1px solid ${t.border}`,fontSize:11}} onClick={()=>k&&hs(k)}>{h}{k&&<SI col={k}/>}</th>)}</tr></thead>
        <tbody>{!paged.length?<tr><td colSpan={10} style={{padding:40,textAlign:'center',color:t.textL}}>없음</td></tr>:paged.map((d,i)=><tr key={i} style={{borderBottom:`1px solid ${t.border}`}} onMouseEnter={e=>e.currentTarget.style.background=t.glass} onMouseLeave={e=>e.currentTarget.style.background=''}>
          <td style={{padding:'8px 12px',fontSize:10,color:t.textM,textAlign:'left'}}>{d.drug_code}<NT d={d}/></td><CN drug={d} onEdit={onEdit}/><td style={{padding:'8px 10px',color:t.textM,fontSize:11}}>{d.category}</td>
          <td style={{padding:'8px 10px',textAlign:'right',fontWeight:600,color:d.stockStatus==='부족'||d.stockStatus==='재고없음'?t.red:t.text}}>{d.current_qty?.toLocaleString()}</td>
          <td style={{padding:'8px 10px',textAlign:'right',color:t.textM}}>{d.safety_stock||'-'}</td><td style={{padding:'8px 10px',textAlign:'right',color:t.textM}}>{d.max_stock||'-'}</td><td style={{padding:'8px 10px',textAlign:'right',color:t.textM}}>{d.monthly_avg||'-'}</td>
          <td style={{padding:'8px 10px'}}><SB s={d.status}/></td>
          <td style={{padding:'8px 10px'}}><Bd bg={sc(d.stockStatus)+'18'} color={sc(d.stockStatus)}>{d.stockStatus}</Bd></td>
          <td style={{padding:'8px 10px',fontSize:11,...exS(d.expiry_date,t)}}>{d.expiry_date||'-'}</td>
          <td style={{padding:'8px 6px',textAlign:'center'}}><button onClick={()=>onAdjust(d)} style={{padding:'3px 8px',borderRadius:4,border:`1px solid ${t.amber}`,background:'transparent',color:t.amber,cursor:'pointer',fontSize:9,fontWeight:600}}>보정</button></td>
        </tr>)}</tbody>
      </table></div>
      <Pg page={page} setPage={setPage} tp={tp} fl={filtered} pp={PP}/>
    </div><Ft/>
  </div>
}

/* ═══ 향정마약 전용 — ★ 카드 클릭 필터링 ═══ */
function NarcoticMgmt({drugs,onEdit,onAdjust}){
  const{t}=useTheme();const[stats,setStats]=useState(['사용']);const narcs=drugs.filter(d=>isN(d)&&stats.includes(d.status));const{hs,so,SI,TS}=useSort('drug_name')
  const[filter,setFilter]=useState('전체')
  const byType={향정:narcs.filter(d=>getNT(d)==='향정'),마약:narcs.filter(d=>getNT(d)==='마약')};const expiring=narcs.filter(d=>{const x=exD(d.expiry_date);return x!==null&&x<=180})
  const display=filter==='전체'?narcs:filter==='향정'?byType['향정']:filter==='마약'?byType['마약']:expiring
  const sorted=so(display)
  const cards=[{k:'전체',v:narcs.length,c:t.purple},{k:'향정',v:byType['향정'].length,c:t.purple},{k:'마약',v:byType['마약'].length,c:t.red},{k:'유효기한 주의',v:expiring.length,c:t.amber}]
  function dl(){const ws=XLSX.utils.json_to_sheet(sorted.map(d=>({약품코드:d.drug_code,약품명:d.drug_name,분류:d.category,구분:getNT(d),현재고:d.current_qty||0,유효기한:d.expiry_date||'',남은일수:exD(d.expiry_date),보관:d.storage_method||'',상태:d.status})));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'향정마약');XLSX.writeFile(wb,`향정마약_${new Date().toISOString().split('T')[0]}.xlsx`)}
  return<div style={{padding:'20px 24px'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><div style={{fontSize:16,fontWeight:700,color:t.purple}}>향정·마약류 관리</div><button onClick={dl} style={{padding:'6px 14px',borderRadius:8,border:`1px solid ${t.green}`,background:t.greenL,color:t.green,cursor:'pointer',fontSize:11,fontWeight:600}}>엑셀</button></div>
    <div style={{background:t.card,borderRadius:12,border:`1px solid ${t.border}`,padding:'10px 16px',marginBottom:12,backdropFilter:'blur(12px)'}}>
      <MP items={STATS} selected={stats} onChange={setStats} color={t.green} label="상태"/>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:14}}>
      {cards.map((c,i)=><div key={i} onClick={()=>setFilter(c.k)} style={{background:filter===c.k?c.c+'15':t.card,border:`1px solid ${filter===c.k?c.c:t.border}`,borderRadius:12,padding:'14px 16px',cursor:'pointer',backdropFilter:'blur(12px)',transition:'all .15s'}} onMouseEnter={e=>{if(filter!==c.k)e.currentTarget.style.borderColor=c.c}} onMouseLeave={e=>{if(filter!==c.k)e.currentTarget.style.borderColor=t.border}}><div style={{fontSize:11,color:filter===c.k?c.c:t.textM,fontWeight:filter===c.k?700:500}}>{c.k}</div><div style={{fontSize:26,fontWeight:700,color:c.c,marginTop:4}}>{c.v}</div></div>)}
    </div>
    <div style={{background:t.card,borderRadius:12,border:`1px solid ${t.border}`,overflow:'hidden',backdropFilter:'blur(12px)'}}>
      <div style={{padding:'12px 18px',borderBottom:`1px solid ${t.border}`,fontWeight:700,fontSize:13,color:t.purple,display:'flex',justifyContent:'space-between'}}><span>{filter==='전체'?'향정·마약 전체':filter} 목록</span><span style={{color:t.textM,fontWeight:500}}>{sorted.length}개</span></div>
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
        <thead><tr>{[['drug_code','약품코드'],['drug_name','약품명'],['category','구분'],['narcotic_type','분류'],['current_qty','현재고'],['expiry_date','유효기한'],['','D-day'],['storage_method','보관'],['status','상태'],['','보정']].map(([k,h])=><th key={h} style={k?TS(k):{padding:'8px 10px',textAlign:'center',color:t.textM,fontWeight:600,borderBottom:`1px solid ${t.border}`,fontSize:11}} onClick={()=>k&&hs(k)}>{h}{k&&<SI col={k}/>}</th>)}</tr></thead>
        <tbody>{sorted.map((d,i)=>{const days=exD(d.expiry_date);const nt=getNT(d);return<tr key={i} style={{borderBottom:`1px solid ${t.border}`}} onMouseEnter={e=>e.currentTarget.style.background=t.glass} onMouseLeave={e=>e.currentTarget.style.background=''}>
          <td style={{padding:'8px 12px',fontSize:10,color:t.textM,textAlign:'left'}}>{d.drug_code}</td><CN drug={d} onEdit={onEdit}/><td style={{padding:'8px 10px',color:t.textM,fontSize:11}}>{d.category}</td>
          <td style={{padding:'8px 10px'}}><Bd bg={nt==='마약'?t.redL:t.purpleL} color={nt==='마약'?t.red:t.purple}>{nt}</Bd></td>
          <td style={{padding:'8px 10px',textAlign:'right',fontWeight:600,color:d.current_qty===0?t.red:t.text}}>{d.current_qty?.toLocaleString()}</td>
          <td style={{padding:'8px 10px',fontSize:11,...exS(d.expiry_date,t)}}>{d.expiry_date||'-'}</td>
          <td style={{padding:'8px 10px'}}>{days!==null?<span style={{fontSize:10,color:days<=30?t.red:days<=90?t.amber:t.textM,fontWeight:600}}>D{days<=0?days:'-'+days}</span>:'-'}</td>
          <td style={{padding:'8px 10px',fontSize:10,color:t.textM}}>{d.storage_method||'-'}</td><td style={{padding:'8px 10px'}}><SB s={d.status}/></td>
          <td style={{padding:'8px 6px',textAlign:'center'}}><button onClick={()=>onAdjust(d)} style={{padding:'3px 8px',borderRadius:4,border:`1px solid ${t.amber}`,background:'transparent',color:t.amber,cursor:'pointer',fontSize:9,fontWeight:600}}>보정</button></td>
        </tr>})}</tbody>
      </table></div>
    </div><Ft/>
  </div>
}

/* ═══ 기초정보 등록 ═══ */
function DrugRegister({onRefresh}) {
  const initForm={drug_code:'',drug_name:'',category:'경구제',manufacturer:'',ingredient_kr:'',price_unit:'',status:'사용',is_narcotic:false,current_qty:0,expiry_date:''}
  const[form,setForm]=useState(initForm)
  const[msg,setMsg]=useState(null)
  const[saving,setSaving]=useState(false)
  const[mode,setMode]=useState('single')
  const[bulk,setBulk]=useState([])
  const[bulkMsg,setBulkMsg]=useState(null)
  const[bulkLoading,setBulkLoading]=useState(false)
  const fileRef=useRef()
  const[apiQuery,setApiQuery]=useState('')
  const[apiResults,setApiResults]=useState([])
  const[apiLoading,setApiLoading]=useState(false)
  const[apiMsg,setApiMsg]=useState(null)

  async function searchApi() {
    if(!apiQuery.trim()){setApiMsg('검색어를 입력해 주세요');return}
    setApiLoading(true);setApiResults([]);setApiMsg(null)
    try{
      const res=await fetch(`/api/drug-search?query=${encodeURIComponent(apiQuery)}`)
      const data=await res.json()
      if(!data.success){setApiMsg(data.error||'검색 실패');setApiLoading(false);return}
      if(!data.items||data.items.length===0){setApiMsg('검색 결과가 없습니다');setApiLoading(false);return}
      setApiResults(data.items)
    }catch(err){setApiMsg('네트워크 오류: '+err.message)}
    setApiLoading(false)
  }

  function applyResult(item) {
    setForm(f=>({...f,
      drug_name:item.ITEM_NAME||item.itemName||f.drug_name,
      manufacturer:item.ENTP_NAME||item.entpName||f.manufacturer,
      ingredient_kr:item.MAIN_ITEM_INGR||item.mainIngr||f.ingredient_kr,
    }))
    setApiResults([]);setApiQuery('');setApiMsg(null)
  }

  function set(k,v){setForm(f=>({...f,[k]:v}))}

  async function submit(){
    if(!form.drug_code.trim()){setMsg({type:'error',text:'약품코드를 입력해 주세요'});return}
    if(!form.drug_name.trim()){setMsg({type:'error',text:'약품명을 입력해 주세요'});return}
    setSaving(true)
    const{error}=await supabase.from('drugs').insert([{
      drug_code:form.drug_code.trim().toUpperCase(),
      drug_name:form.drug_name.trim(),
      category:form.category,
      manufacturer:form.manufacturer,
      ingredient_kr:form.ingredient_kr,
      price_unit:Number(form.price_unit)||0,
      status:form.status,
      is_narcotic:form.is_narcotic,
      current_qty:Number(form.current_qty)||0,
      expiry_date:form.expiry_date||null,
    }])
    setSaving(false)
    if(error){
      const msg2=error.message.includes('duplicate')||error.message.includes('unique')
        ?'이미 존재하는 약품코드입니다.':'등록 실패: '+error.message
      setMsg({type:'error',text:msg2});return
    }
    setMsg({type:'success',text:`${form.drug_name} 등록 완료!`})
    setForm(initForm);onRefresh()
    setTimeout(()=>setMsg(null),3000)
  }

  function edts(v){if(!v) return '';if(typeof v==='string'&&v.includes('-')) return v;if(typeof v==='number'){const d=new Date(Math.round((v-25569)*86400*1000));return d.toISOString().split('T')[0]}return String(v)}

  function xlUpload(e){
    const file=e.target.files[0];if(!file) return;setBulkMsg(null)
    const reader=new FileReader()
    reader.onload=ev=>{
      try{
        const wb2=XLSX.read(ev.target.result,{type:'array'})
        const rows=XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]],{defval:''})
        if(rows.length===0){setBulkMsg({type:'error',text:'데이터가 없습니다.'});return}
        const parsed=rows.map((r,i)=>{
          const code=String(r['약품코드']||r['drug_code']||'').trim().toUpperCase()
          return{
            idx:i+1,drug_code:code,
            drug_name:String(r['약품명']||r['drug_name']||'').trim(),
            category:String(r['구분']||r['category']||'경구제').trim(),
            manufacturer:String(r['제조사']||r['manufacturer']||'').trim(),
            ingredient_kr:String(r['성분명']||r['ingredient_kr']||'').trim(),
            price_unit:Number(r['단가']||r['price_unit']||0),
            status:String(r['상태']||r['status']||'사용').trim(),
            is_narcotic:String(r['향정마약']||'N').trim()==='Y'||String(r['향정마약']||'').trim()==='향정',
            current_qty:Number(r['현재고']||r['current_qty']||0),
            expiry_date:edts(r['유효기한']||r['expiry_date']||''),
            valid:!!code&&!!(String(r['약품명']||r['drug_name']||'').trim())
          }
        })
        setBulk(parsed)
        setBulkMsg({type:'info',text:`${parsed.length}행 읽음 · 유효: ${parsed.filter(r=>r.valid).length}행 · 오류: ${parsed.filter(r=>!r.valid).length}행`})
      }catch(err){setBulkMsg({type:'error',text:'파일 읽기 오류: '+err.message})}
    }
    reader.readAsArrayBuffer(file);e.target.value=''
  }

  async function bulkSubmit(){
    const valid=bulk.filter(r=>r.valid)
    if(valid.length===0){setBulkMsg({type:'error',text:'등록 가능한 데이터가 없습니다.'});return}
    setBulkLoading(true)
    const{error}=await supabase.from('drugs').insert(valid.map(r=>({
      drug_code:r.drug_code,drug_name:r.drug_name,category:r.category,
      manufacturer:r.manufacturer,ingredient_kr:r.ingredient_kr,
      price_unit:r.price_unit,status:r.status,is_narcotic:r.is_narcotic,
      current_qty:r.current_qty,expiry_date:r.expiry_date||null,
    })))
    setBulkLoading(false)
    if(error){setBulkMsg({type:'error',text:'등록 실패: '+error.message});return}
    setBulkMsg({type:'success',text:`${valid.length}건 일괄 등록 완료!`})
    setBulk([]);onRefresh();setTimeout(()=>setBulkMsg(null),4000)
  }

  function dlTemplate(){
    const ws=XLSX.utils.aoa_to_sheet([
      ['약품코드','약품명','구분','제조사','성분명','단가','상태','향정마약','현재고','유효기한'],
      ['NEWDRUG001','신규약품정1mg','경구제','제조사명','성분명',1000,'사용','N',100,'2028-12-31'],
    ])
    const wb2=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb2,ws,'기초정보등록')
    XLSX.writeFile(wb2,'기초정보_업로드_양식.xlsx')
  }

  const inp={width:'100%',padding:'9px 12px',border:`1.5px solid ${C.grayB}`,borderRadius:8,fontSize:13,outline:'none',boxSizing:'border-box'}
  const lbl={fontSize:12,color:'#666',marginBottom:4,display:'block',fontWeight:500}
  const tabBtn=active=>({padding:'8px 20px',borderRadius:8,border:'none',cursor:'pointer',fontSize:13,fontWeight:600,background:active?C.purple:C.grayL,color:active?'#fff':'#888'})

  return(
    <div style={{padding:'20px 28px'}}>
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        <button style={tabBtn(mode==='single')} onClick={()=>setMode('single')}>개별 등록</button>
        <button style={tabBtn(mode==='bulk')} onClick={()=>setMode('bulk')}>엑셀 대량 등록</button>
      </div>

      {mode==='single'&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
          <div style={{background:'#fff',borderRadius:12,border:`0.5px solid ${C.grayB}`,padding:'22px 24px'}}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:16,paddingBottom:12,borderBottom:`0.5px solid ${C.grayB}`}}>
              신규 약품 기초정보 등록
            </div>

            {/* 공공API 검색 */}
            <div style={{background:C.purpleL,borderRadius:10,padding:'14px 16px',marginBottom:16,border:`0.5px solid ${C.purpleB}`}}>
              <div style={{fontSize:12,color:C.purple,fontWeight:600,marginBottom:8}}>🔍 공공데이터 API 검색 (허가정보)</div>
              <div style={{display:'flex',gap:8}}>
                <input value={apiQuery} onChange={e=>setApiQuery(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&searchApi()}
                  placeholder="약품명으로 검색 후 클릭하면 자동입력"
                  style={{flex:1,padding:'8px 12px',border:`1.5px solid ${C.purpleB}`,borderRadius:8,fontSize:13,outline:'none'}}
                  onFocus={e=>e.target.style.borderColor=C.purple}
                  onBlur={e=>e.target.style.borderColor=C.purpleB}/>
                <button onClick={searchApi} disabled={apiLoading}
                  style={{padding:'8px 16px',borderRadius:8,border:'none',background:apiLoading?C.grayB:C.purple,color:'#fff',cursor:apiLoading?'not-allowed':'pointer',fontSize:13,fontWeight:600,whiteSpace:'nowrap'}}>
                  {apiLoading?'검색중...':'검색'}
                </button>
              </div>
              {apiMsg&&<div style={{fontSize:12,color:C.coral,marginTop:6}}>{apiMsg}</div>}
              {apiResults.length>0&&(
                <div style={{marginTop:8,background:'#fff',borderRadius:8,border:`0.5px solid ${C.purpleB}`,maxHeight:180,overflowY:'auto'}}>
                  <div style={{fontSize:11,color:'#888',padding:'6px 12px',borderBottom:`0.5px solid ${C.grayB}`}}>
                    {apiResults.length}개 결과 · 클릭하면 자동 입력
                  </div>
                  {apiResults.map((item,i)=>(
                    <div key={i} onClick={()=>applyResult(item)}
                      style={{padding:'9px 12px',borderBottom:`0.5px solid #f5f5f5`,cursor:'pointer',fontSize:13}}
                      onMouseEnter={e=>e.currentTarget.style.background=C.purpleL}
                      onMouseLeave={e=>e.currentTarget.style.background=''}>
                      <div style={{fontWeight:600,color:'#333',textAlign:'left'}}>{item.ITEM_NAME||item.itemName||'-'}</div>
                      <div style={{fontSize:11,color:'#888',marginTop:2}}>{item.ENTP_NAME||item.entpName||''}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {msg&&<div style={{background:msg.type==='success'?C.greenL:C.coralL,border:`1px solid ${msg.type==='success'?C.greenB:C.coralB}`,borderRadius:8,padding:'10px 14px',marginBottom:14,color:msg.type==='success'?C.greenD:C.coral,fontSize:13}}>{msg.text}</div>}

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
              <div>
                <label style={lbl}>약품코드 <span style={{color:C.coral}}>*</span></label>
                <input value={form.drug_code} onChange={e=>set('drug_code',e.target.value.toUpperCase())} placeholder="예: NEWDRUG001" style={inp} onFocus={e=>e.target.style.borderColor=C.purple} onBlur={e=>e.target.style.borderColor=C.grayB}/>
              </div>
              <div>
                <label style={lbl}>구분</label>
                <select value={form.category} onChange={e=>set('category',e.target.value)} style={{...inp,background:'#fff'}}>
                  {['경구제','주사제','외용제','수액제','영양제','의약외품'].map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <label style={lbl}>약품명 <span style={{color:C.coral}}>*</span></label>
              <input value={form.drug_name} onChange={e=>set('drug_name',e.target.value)} placeholder="약품명" style={inp} onFocus={e=>e.target.style.borderColor=C.purple} onBlur={e=>e.target.style.borderColor=C.grayB}/>
            </div>
            <div style={{marginBottom:14}}>
              <label style={lbl}>제조사</label>
              <input value={form.manufacturer} onChange={e=>set('manufacturer',e.target.value)} placeholder="제조사명" style={inp} onFocus={e=>e.target.style.borderColor=C.purple} onBlur={e=>e.target.style.borderColor=C.grayB}/>
            </div>
            <div style={{marginBottom:14}}>
              <label style={lbl}>성분명</label>
              <input value={form.ingredient_kr} onChange={e=>set('ingredient_kr',e.target.value)} placeholder="성분명" style={inp} onFocus={e=>e.target.style.borderColor=C.purple} onBlur={e=>e.target.style.borderColor=C.grayB}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
              <div><label style={lbl}>개당단가 (원)</label><input type="number" value={form.price_unit} onChange={e=>set('price_unit',e.target.value)} placeholder="0" style={inp} onFocus={e=>e.target.style.borderColor=C.purple} onBlur={e=>e.target.style.borderColor=C.grayB}/></div>
              <div><label style={lbl}>초기 현재고</label><input type="number" value={form.current_qty} onChange={e=>set('current_qty',e.target.value)} placeholder="0" style={inp} onFocus={e=>e.target.style.borderColor=C.purple} onBlur={e=>e.target.style.borderColor=C.grayB}/></div>
            </div>
            <div style={{marginBottom:14}}>
              <label style={lbl}>유효기한</label>
              <input type="date" value={form.expiry_date} onChange={e=>set('expiry_date',e.target.value)} style={inp} onFocus={e=>e.target.style.borderColor=C.purple} onBlur={e=>e.target.style.borderColor=C.grayB}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
              <div>
                <label style={lbl}>상태</label>
                <select value={form.status} onChange={e=>set('status',e.target.value)} style={{...inp,background:'#fff'}}>
                  {['사용','중지','휴면'].map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{...lbl,marginBottom:8}}>향정마약</label>
                <div style={{display:'flex',gap:6}}>
                  <button onClick={()=>set('is_narcotic',false)} style={{flex:1,padding:'8px',borderRadius:8,border:`2px solid ${!form.is_narcotic?C.green:'transparent'}`,cursor:'pointer',background:!form.is_narcotic?C.greenL:C.grayL,color:!form.is_narcotic?C.green:'#999',fontWeight:600,fontSize:12}}>일반</button>
                  <button onClick={()=>set('is_narcotic',true)} style={{flex:1,padding:'8px',borderRadius:8,border:`2px solid ${form.is_narcotic?C.lavender:'transparent'}`,cursor:'pointer',background:form.is_narcotic?C.lavL:C.grayL,color:form.is_narcotic?C.lavender:'#999',fontWeight:600,fontSize:12}}>향정</button>
                </div>
              </div>
            </div>
            <button onClick={submit} disabled={saving} style={{width:'100%',padding:12,borderRadius:10,border:'none',cursor:saving?'not-allowed':'pointer',background:saving?C.grayB:C.purple,color:'#fff',fontSize:14,fontWeight:700}}>
              {saving?'등록 중...':'약품 등록'}
            </button>
          </div>

          <div style={{background:C.purpleL,borderRadius:12,padding:'18px 20px',border:`0.5px solid ${C.purpleB}`,alignSelf:'start'}}>
            <div style={{fontSize:14,fontWeight:600,color:C.purple,marginBottom:10}}>등록 안내</div>
            <div style={{fontSize:12,color:C.purpleD,lineHeight:1.9}}>
              • <strong>공공데이터 검색</strong>으로 약품명 자동 입력<br/>
              • <strong>약품코드</strong>: 고유한 코드 (중복 불가)<br/>
              • 등록 후 <strong>약품목록</strong>에서 수정 가능<br/>
              • 여러 약품은 <strong>엑셀 대량 등록</strong> 탭 활용
            </div>
          </div>
        </div>
      )}

      {mode==='bulk'&&(
        <div style={{background:'#fff',borderRadius:12,border:`0.5px solid ${C.grayB}`,padding:'22px 24px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18,paddingBottom:12,borderBottom:`0.5px solid ${C.grayB}`}}>
            <div style={{fontSize:15,fontWeight:700}}>기초정보 엑셀 대량 등록</div>
            <button onClick={dlTemplate} style={{padding:'8px 16px',borderRadius:8,border:`1px solid ${C.purple}`,background:C.purpleL,color:C.purple,cursor:'pointer',fontSize:12,fontWeight:500}}>양식 다운로드</button>
          </div>
          <div style={{background:C.grayL,border:`2px dashed ${C.grayB}`,borderRadius:10,padding:'36px',textAlign:'center',marginBottom:16,cursor:'pointer'}}
            onClick={()=>fileRef.current.click()}
            onMouseEnter={e=>e.currentTarget.style.borderColor=C.purple}
            onMouseLeave={e=>e.currentTarget.style.borderColor=C.grayB}>
            <div style={{fontSize:40,marginBottom:10}}>📋</div>
            <div style={{fontSize:14,fontWeight:500,color:'#555',marginBottom:4}}>엑셀 파일을 클릭하여 선택하세요</div>
            <div style={{fontSize:12,color:'#aaa'}}>.xlsx / .xls 파일 지원</div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={xlUpload} style={{display:'none'}}/>
          </div>
          {bulkMsg&&<div style={{background:bulkMsg.type==='success'?C.greenL:bulkMsg.type==='error'?C.coralL:C.blueL,border:`1px solid ${bulkMsg.type==='success'?C.greenB:bulkMsg.type==='error'?C.coralB:C.blueB}`,borderRadius:8,padding:'10px 14px',marginBottom:14,color:bulkMsg.type==='success'?C.greenD:bulkMsg.type==='error'?C.coral:C.blue,fontSize:13}}>{bulkMsg.text}</div>}
          {bulk.length>0&&(
            <>
              <div style={{overflowX:'auto',marginBottom:14,maxHeight:380,overflowY:'auto',border:`0.5px solid ${C.grayB}`,borderRadius:8}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead style={{position:'sticky',top:0}}><tr style={{background:'#fafafa'}}>
                    {['#','상태','약품코드','약품명','구분','제조사','단가','현재고','유효기한','상태','향정'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',color:'#666',fontWeight:500,borderBottom:`0.5px solid ${C.grayB}`,whiteSpace:'nowrap'}}>{h}</th>)}
                  </tr></thead>
                  <tbody>{bulk.map((r,i)=>(
                    <tr key={i} style={{borderBottom:`0.5px solid #f5f5f5`,background:r.valid?'':C.coralL+'50'}}>
                      <td style={{padding:'7px 10px',color:'#bbb'}}>{r.idx}</td>
                      <td style={{padding:'7px 10px'}}>{r.valid?<span style={{background:C.greenL,color:C.greenD,padding:'2px 7px',borderRadius:6,fontSize:10,fontWeight:600}}>정상</span>:<span style={{background:C.coralL,color:C.coral,padding:'2px 7px',borderRadius:6,fontSize:10,fontWeight:600}}>오류</span>}</td>
                      <td style={{padding:'7px 10px',fontFamily:'monospace',fontSize:10,color:'#888'}}>{r.drug_code||'없음'}</td>
                      <td style={{padding:'7px 10px',fontWeight:500,textAlign:'left'}}>{r.drug_name||'-'}</td>
                      <td style={{padding:'7px 10px',color:'#666'}}>{r.category}</td>
                      <td style={{padding:'7px 10px',color:'#888'}}>{r.manufacturer||'-'}</td>
                      <td style={{padding:'7px 10px',textAlign:'right'}}>{r.price_unit?.toLocaleString()}</td>
                      <td style={{padding:'7px 10px',textAlign:'right'}}>{r.current_qty?.toLocaleString()}</td>
                      <td style={{padding:'7px 10px',color:'#888'}}>{r.expiry_date||'-'}</td>
                      <td style={{padding:'7px 10px'}}><StatusBadge status={r.status}/></td>
                      <td style={{padding:'7px 10px'}}>{r.is_narcotic?<span style={{background:C.lavL,color:C.lavender,padding:'1px 6px',borderRadius:4,fontSize:10}}>향정</span>:'-'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>{setBulk([]);setBulkMsg(null)}} style={{flex:1,padding:11,borderRadius:10,border:`1px solid ${C.grayB}`,cursor:'pointer',background:'#fff',color:'#888',fontSize:13}}>취소</button>
                <button onClick={bulkSubmit} disabled={bulkLoading||bulk.filter(r=>r.valid).length===0}
                  style={{flex:2,padding:11,borderRadius:10,border:'none',cursor:bulkLoading?'not-allowed':'pointer',background:bulkLoading?C.grayB:C.purple,color:'#fff',fontSize:14,fontWeight:700}}>
                  {bulkLoading?'등록 중...':`정상 ${bulk.filter(r=>r.valid).length}건 일괄 등록`}
                </button>
              </div>
            </>
          )}
          <div style={{marginTop:18,background:C.purpleL,borderRadius:10,padding:'14px 16px',fontSize:12,color:C.purpleD,lineHeight:1.9,border:`0.5px solid ${C.purpleB}`}}>
            <strong>엑셀 양식 안내</strong><br/>
            필수: 약품코드, 약품명 · 향정마약: Y 또는 향정<br/>
            구분: 경구제/주사제/외용제/수액제/영양제/의약외품
          </div>
        </div>
      )}
      <Footer/>
    </div>
  )
}