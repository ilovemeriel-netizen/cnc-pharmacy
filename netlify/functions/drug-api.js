// Netlify Serverless Function - 공공데이터 API 프록시
// 브라우저 CORS 제한을 서버에서 우회합니다

const APIs = {
  easy: { url: 'https://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList', param: 'itemName' },
  identify: { url: 'https://apis.data.go.kr/1471000/MdcinGrnIdntfcInfoService01/getMdcinGrnIdntfcInfoList01', param: 'item_name' },
  permit: { url: 'https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService05/getDrugPrdtPrmsnDtlInq04', param: 'item_name' },
  ati: { url: 'https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService05/getDrugPrdtPrmsnDtlInq04', param: 'item_name' },
  dur: { url: 'https://apis.data.go.kr/1471000/DURPrdlstInfoService03/getDurPrdlstInfoList03', param: 'itemName' },
  maxDose: { url: 'https://apis.data.go.kr/1471000/DailyMaxDosgQyInfoService/getDailyMaxDosgQyList', param: 'itemName' },
  permit2: { url: 'https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService05/getDrugPrdtPrmsnDtlInq05', param: 'item_name' },
}

export default async (req) => {
  const url = new URL(req.url)
  const keyword = url.searchParams.get('keyword')
  const apiType = url.searchParams.get('type') || 'easy'
  const apiKey = process.env.DATA_API_KEY

  if (!keyword) {
    return new Response(JSON.stringify({ ok: false, msg: '검색어를 입력하세요', data: [] }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }

  if (!apiKey) {
    return new Response(JSON.stringify({ ok: false, msg: 'API 키가 설정되지 않았습니다', data: [] }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }

  const api = APIs[apiType] || APIs.easy
  const fetchUrl = `${api.url}?serviceKey=${encodeURIComponent(apiKey)}&${api.param}=${encodeURIComponent(keyword)}&type=json&numOfRows=20`

  try {
    const res = await fetch(fetchUrl)
    const text = await res.text()

    let data = []
    try {
      const json = JSON.parse(text)
      const body = json?.body || json?.response?.body
      const items = body?.items?.item || body?.items || []
      data = Array.isArray(items) ? items : items ? [items] : []
    } catch {
      return new Response(JSON.stringify({ ok: false, msg: 'API 응답 파싱 실패 (XML 형식일 수 있음)', data: [] }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    return new Response(JSON.stringify({ ok: true, data, total: data.length }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, msg: '서버 요청 실패: ' + e.message, data: [] }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
}

export const config = { path: "/api/drug" }
