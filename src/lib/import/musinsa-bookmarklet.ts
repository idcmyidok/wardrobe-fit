/**
 * 무신사 주문내역 페이지에서 누르는 북마크 버튼(즐겨찾기에 저장하는 javascript: 주소).
 * 상품 링크 바로 앞에 "⟦G:상품번호⟧" 줄을 잠깐 끼워 넣고 페이지 글 전체를 복사한 뒤 원래대로 돌린다.
 * 페이지를 읽기만 하고 아무 데도 보내지 않는다. 버튼 글자(재구매·스냅 보기 등) 링크는 건너뛴다.
 * 휴대폰(특히 사파리)은 북마크로 실행하면 바로 복사를 막는 경우가 있어, 그때는 화면에 복사하기 버튼을 띄워 한 번 더 누르게 한다.
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
const msg='상품 '+n+'개 번호와 주문내역을 복사했어요. Wardrobe Fit에 붙여 넣어 주세요.';
const legacy=()=>{const ta=document.createElement('textarea');ta.value=text;ta.readOnly=true;ta.style.cssText='position:fixed;top:0;left:0;opacity:0;';document.body.appendChild(ta);ta.focus();ta.setSelectionRange(0,text.length);let ok=false;try{ok=document.execCommand('copy');}catch(e){}ta.remove();return ok;};
const panel=()=>{
const w=document.createElement('div');w.id='wf-copy';w.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px;font:16px/1.5 sans-serif;';
const box=document.createElement('div');box.style.cssText='background:#fff;color:#111;padding:20px;max-width:360px;width:100%;display:flex;flex-direction:column;gap:12px;';
const p=document.createElement('p');p.textContent='상품 '+n+'개가 담긴 주문내역을 찾았어요. 아래 버튼을 눌러 복사해 주세요.';
const b=document.createElement('button');b.type='button';b.textContent='복사하기';b.style.cssText='min-height:48px;font-size:18px;background:#111;color:#fff;border:0;';
const c=document.createElement('button');c.type='button';c.textContent='닫기';c.style.cssText='min-height:40px;background:none;border:1px solid #111;color:#111;';
const fin=()=>{w.remove();alert(msg);};
b.onclick=()=>{if(legacy())return fin();if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(fin,()=>{p.textContent='자동 복사가 막혀 있어요. 아래 글을 길게 눌러 모두 선택한 뒤 복사해 주세요.';const t=document.createElement('textarea');t.value=text;t.rows=6;t.style.cssText='width:100%;font-size:12px;';box.insertBefore(t,b);b.remove();});};
c.onclick=()=>w.remove();
box.append(p,b,c);w.append(box);document.body.appendChild(w);
};
const old=document.getElementById('wf-copy');if(old)old.remove();
if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(()=>alert(msg),panel);else panel();
})()`;

export const MUSINSA_BOOKMARKLET = `javascript:${encodeURIComponent(source.replace(/\n/g, ""))}`;
