/**
 * 무신사 주문내역 페이지에서 누르는 북마크 버튼(즐겨찾기에 저장하는 javascript: 주소).
 * 상품 링크 바로 앞에 "⟦G:상품번호⟧" 줄을 잠깐 끼워 넣고 페이지 글 전체를 복사한 뒤 원래대로 돌린다.
 * 페이지를 읽기만 하고 아무 데도 보내지 않는다. 버튼 글자(재구매·스냅 보기 등) 링크는 건너뛴다.
 */
const source = `(()=>{
const re=/(?:\\/products\\/|\\/goods\\/|goodsNo=)(\\d{4,})/;
const skip=/재구매|스냅|후기|배송|상세|조회|문의|리뷰|장바구니/;
const added=[];
document.querySelectorAll('a[href]').forEach(a=>{
const m=(a.getAttribute('href')||'').match(re);if(!m)return;
const t=(a.innerText||'').trim();if(t&&skip.test(t))return;
const d=document.createElement('div');d.textContent='⟦G:'+m[1]+'⟧';a.parentNode.insertBefore(d,a);added.push(d);
});
const text=document.body.innerText;added.forEach(d=>d.remove());
const n=new Set(added.map(d=>d.textContent)).size;
const done=()=>alert('상품 '+n+'개 번호와 주문내역을 복사했어요. Wardrobe Fit에 붙여 넣어 주세요.');
if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(done,()=>prompt('자동 복사가 막혀 있어요. 아래 글을 모두 복사해 주세요.',text));
else prompt('아래 글을 모두 복사해 주세요.',text);
})()`;

export const MUSINSA_BOOKMARKLET = `javascript:${encodeURIComponent(source.replace(/\n/g, ""))}`;
