/**
 * 무신사 상품 페이지에서 누르는 북마크 버튼.
 * 무신사가 서버의 직접 요청을 막아서, 사용자 브라우저가 읽은 페이지(HTML)와 실측 등 JSON을
 * 옷 추가 화면(새 탭)으로 넘긴다. 넘기는 곳은 이 사이트 주소(origin)뿐이다.
 * 새 탭을 먼저 열어(팝업 차단 방지) 준비 신호(wf-ready)를 받은 뒤 보낸다.
 */
export function musinsaProductBookmarklet(origin: string): string {
  const source = `(()=>{
const m=location.pathname.match(/\\/(?:products|goods)\\/(\\d{4,})/);
if(!/(^|\\.)musinsa\\.com$/.test(location.hostname)||!m){alert('무신사 상품 페이지에서 눌러 주세요.');return;}
const O=${JSON.stringify(origin)};
const w=window.open(O+'/wardrobe/new?musinsa=1','wf-musinsa');
if(!w){alert('새 창이 막혀 있어요. 허용한 뒤 다시 눌러 주세요.');return;}
const no=m[1];
const H='https://goods-detail.musinsa.com/api2/goods/'+no;
const urls=[H,H+'/actual-size',H+'/v2/actual-size','https://like.musinsa.com/like/api/v2/liketypes/goods/counts?relationIds='+no];
const json={};
const ready=Promise.all(urls.map(async u=>{try{const r=await fetch(u);if(r.ok)json[u]=await r.text();}catch(e){}}));
const onMsg=async e=>{
if(e.origin!==O||!e.data||e.data.type!=='wf-ready')return;
removeEventListener('message',onMsg);
await ready;
w.postMessage({type:'wf-musinsa',url:location.origin+'/products/'+no,html:document.documentElement.outerHTML,json},O);
};
addEventListener('message',onMsg);
})()`;
  return `javascript:${encodeURIComponent(source.replace(/\n/g, ""))}`;
}
