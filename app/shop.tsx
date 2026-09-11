'use client';
import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,Grid2X2,Heart,House,Search,ShoppingBag,Truck,RefreshCw,UserRound} from 'lucide-react';
import {money,PRODUCT_COLLECTIONS,type Product} from './catalog';

function status(p:Product){return (p.stock??1)<=0?'품절':(p.saleStatus??(p.sample?'판매 준비':'판매중'))}
function ProductCard({p,index,wished,onWish}:{p:Product;index:number;wished:boolean;onWish:()=>void}){
  const discount=Math.max(0,Math.round((1-p.price/p.original)*100));
  return <article className="product-card"><a className="product-image" href={`/product/${p.id}`}><img src={p.image} alt={p.name} style={{objectPosition:`${p.imagePositionX??50}% ${p.imagePositionY??50}%`}} loading={index<4?'eager':'lazy'} fetchPriority={index<2?'high':'low'} decoding="async"/><span>{status(p)}</span></a><button className={`heart ${wished?'active':''}`} onClick={onWish} aria-label={`${p.name} 찜`}><Heart size={22} fill={wished?'currentColor':'none'}/></button><a className="product-info" href={`/product/${p.id}`}><div className="price">{discount>0&&<strong>{discount}%</strong>}{discount>0&&<del>{money(p.original)}</del>}<b>{money(p.price)}</b></div><h3>{p.name}</h3><span className="product-colors">{p.colors.join(', ')}</span><span className="card-labels">{p.collections?.filter(x=>['BEST','NEW','MADE','오늘의할인'].includes(x)).map(x=><i key={x}>{x}</i>)}{p.todayDispatch&&<i>오늘출발</i>}</span><small className="product-stats">{(p.salesCount??0).toLocaleString('ko-KR')}개 구매중 <em>|</em> 평점 {(p.averageRating??0).toFixed(1)} · 리뷰 {(p.reviewCount??0).toLocaleString('ko-KR')}</small></a></article>
}
function HomeProductSection({kicker,title,collection,products,wish,toggle}:{kicker:string;title:string;collection:string;products:Product[];wish:string[];toggle:(id:string)=>void}){
  return <section className="home-product-section"><div className="home-section-title"><span>{kicker}</span><h2>{title}</h2></div><div className="product-grid home-products">{products.map((p,i)=><ProductCard key={`${collection}-${p.id}`} p={p} index={i+4} wished={wish.includes(p.id)} onWish={()=>toggle(p.id)}/>)}</div><a className="section-more" href={`/collection/${encodeURIComponent(collection)}`}>MORE <ArrowRight size={15}/></a></section>
}

export default function Shop({initialProducts,isAdmin=false}:{initialProducts:Product[];isAdmin?:boolean}){
  const [query,setQuery]=useState(''),[category,setCategory]=useState('전체'),[wish,setWish]=useState<string[]>([]),[viewed,setViewed]=useState<string[]>([]),[cartIds,setCartIds]=useState<string[]>([]),[page,setPage]=useState(1),[sort,setSort]=useState('추천순');
  useEffect(()=>{try{setWish(JSON.parse(localStorage.getItem('somi_wish')||'[]'));setViewed(JSON.parse(localStorage.getItem('somi_viewed')||'[]'));setCartIds(JSON.parse(localStorage.getItem('somi_cart')||'[]').map((x:{product:Product})=>x.product.id))}catch{}},[]);
  useEffect(()=>localStorage.setItem('somi_wish',JSON.stringify(wish)),[wish]);
  const choose=(item:string)=>{setCategory(item);setPage(1);document.getElementById('catalog')?.scrollIntoView({behavior:'smooth'})};
  const toggle=(id:string)=>setWish(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);
  const filtered=useMemo(()=>initialProducts.filter(p=>(category==='전체'||p.category===category||p.collections?.includes(category))&&`${p.name} ${p.brand}`.toLowerCase().includes(query.toLowerCase())),[initialProducts,category,query]);
  const sorted=[...filtered].sort((a,b)=>sort==='리뷰많은순'?(b.reviewCount??0)-(a.reviewCount??0):sort==='판매랭킹순'?(b.salesCount??0)-(a.salesCount??0):sort==='낮은가격순'?a.price-b.price:sort==='할인율순'?(1-b.price/b.original)-(1-a.price/a.original):0);
  const perPage=8,totalPages=Math.max(1,Math.ceil(sorted.length/perPage)),currentPage=Math.min(page,totalPages),visible=sorted.slice((currentPage-1)*perPage,currentPage*perPage);
  const best=[...initialProducts].sort((a,b)=>(b.salesCount??0)-(a.salesCount??0)).slice(0,8);
  const inCollection=(name:string,fallback:Product[])=>{const items=initialProducts.filter(p=>p.collections?.includes(name));return (items.length?items:fallback).slice(0,8)};
  const newItems=inCollection('NEW',[...initialProducts].reverse()),saleItems=inCollection('오늘의할인',[...initialProducts].sort((a,b)=>(1-b.price/b.original)-(1-a.price/a.original))),todayItems=initialProducts.filter(p=>p.todayDispatch).slice(0,8);
  const interests=[...new Set([...viewed,...wish,...cartIds])].map(id=>initialProducts.find(p=>p.id===id)).filter((p):p is Product=>Boolean(p));
  const personalized=initialProducts.filter(p=>!interests.some(x=>x.id===p.id)).map(p=>({p,score:interests.reduce((n,x)=>n+(x.category===p.category?3:0)+(x.styleTag&&x.styleTag===p.styleTag?2:0),0)})).sort((a,b)=>b.score-a.score||(b.p.salesCount??0)-(a.p.salesCount??0)).slice(0,4).map(x=>x.p);
  return <>
    <div className="topline"><span>첫 로그인 3,000원 쿠폰</span><span>오늘 밤 9시까지 주문하면 오늘출발</span><span>사이즈 무료교환</span></div>
    <div className="utility-bar"><span>매일 오전 11시 신상품 업데이트</span><nav><a href="/login">로그인</a><a href="/account">마이페이지</a>{isAdmin&&<a href="/admin">관리자</a>}</nav></div>
    <header className="header"><a className="logo" href="/">somi<span>mall</span><i/></a><label className="search"><input aria-label="상품 검색" placeholder="어떤 스타일을 찾으세요?" value={query} onChange={e=>setQuery(e.target.value)}/><Search size={21}/></label><div className="header-actions"><a href="/account" aria-label="마이페이지"><UserRound/></a><a href="/wishlist" aria-label="찜"><Heart/></a><a className="cart-icon" href="/cart" aria-label="장바구니"><ShoppingBag/>{cartIds.length>0&&<i>{cartIds.length}</i>}</a></div></header>
    <main className="shell">
      <nav className="mainnav" aria-label="상품 카테고리">{PRODUCT_COLLECTIONS.map(item=><a key={item} className={category===item?'selected':''} href={`/collection/${encodeURIComponent(item)}`}>{item}</a>)}</nav>
      <section className="brand-intro-row"><aside className="brand-note"><span>SOMIMALL STORY</span><p>홍대 옷가게 직원이 답답해서 직접 차린 쇼핑몰.</p><p>실제 직원의 모든 경험을 토대로 핏, 가성비 ITEM, 핫 ITEM을 소개합니다.</p></aside></section>
      <section className="service-strip"><div><Truck/><span><b>오늘출발</b><small>오후 9시 전 주문 시</small></span></div><div><RefreshCw/><span><b>사이즈 무료교환</b><small>첫 교환 배송비 무료</small></span></div><div><Heart/><span><b>소미 셀렉션</b><small>직접 입어보고 고른 상품</small></span></div></section>
      <HomeProductSection kicker="가을 신상 오픈 · 최대 60%" title="가을맞이 득템찬스 🛍️" collection="오늘의할인" products={saleItems} wish={wish} toggle={toggle}/>
      <HomeProductSection kicker="지금 가장 많이 담긴 옷" title="WEEKLY BEST" collection="BEST" products={best} wish={wish} toggle={toggle}/>
      <section className="editorial-banner"><div><span>NEW SEASON</span><h2>간절기의 온도,<br/>가볍고 섬세하게</h2><p>출근부터 주말 약속까지 이어지는 데일리 셋업</p></div><img src="/autumn-fashion-banner.png" alt="차분한 가을 재킷과 트렌치코트 스타일"/></section>
      <HomeProductSection kicker="오늘 올라온 신상, 할인 중이에요" title="NEW ITEM" collection="NEW" products={newItems} wish={wish} toggle={toggle}/>
      {todayItems.length>0&&<section className="home-product-section delivery-section"><div className="home-section-title"><span>오늘출발 · 빠른배송 🚚</span><h2>기다림 없이 만나는 옷</h2></div><div className="product-grid home-products">{todayItems.map((p,i)=><ProductCard key={`today-${p.id}`} p={p} index={i+4} wished={wish.includes(p.id)} onWish={()=>toggle(p.id)}/>)}</div><a className="section-more" href="/today">MORE <ArrowRight size={15}/></a></section>}
      <section id="catalog"><div className="section-head"><div><span className="eyebrow">NEW ARRIVALS</span><h2>{category==='전체'?'매일 새롭게 만나는 소미몰':`${category} 컬렉션`}</h2></div><label className="catalog-sort"><span>{filtered.length}개</span><select value={sort} onChange={e=>{setSort(e.target.value);setPage(1)}} aria-label="상품 정렬"><option>추천순</option><option>판매랭킹순</option><option>리뷰많은순</option><option>낮은가격순</option><option>할인율순</option></select></label></div><div className="category-pills">{(['전체',...PRODUCT_COLLECTIONS] as const).map(item=><button key={item} className={category===item?'selected':''} onClick={()=>choose(item)}>{item}</button>)}</div><div className="product-grid">{visible.map((p,i)=><ProductCard key={p.id} p={p} index={i} wished={wish.includes(p.id)} onWish={()=>toggle(p.id)}/>)}</div>{!filtered.length&&<p className="empty">검색한 상품이 없어요.</p>}{filtered.length>0&&<nav className="pagination"><button disabled={currentPage===1} onClick={()=>setPage(v=>Math.max(1,v-1))}>이전</button><b>{currentPage} / {totalPages}</b><button disabled={currentPage===totalPages} onClick={()=>setPage(v=>Math.min(totalPages,v+1))}>다음</button></nav>}</section>
      {interests.length>0&&personalized.length>0&&<section className="personalized"><div className="section-head"><div><span className="eyebrow">FOR YOUR MOOD</span><h2>최근 취향과 어울리는 상품</h2></div></div><div className="recommend-grid">{personalized.map(p=><a href={`/product/${p.id}`} key={p.id}><img src={p.image} alt={p.name} loading="lazy"/><b>{p.name}</b><span>{money(p.price)}원</span></a>)}</div></section>}
      <footer className="store-footer"><div><a className="logo" href="/">somimall<i/></a><p>취향을 발견하는 작은 즐거움.</p></div><div><b>CUSTOMER CENTER</b><p>평일 11:00 — 17:00<br/>점심 12:00 — 13:00</p></div><div><b>SHOPPING GUIDE</b><a href="/account">주문조회</a><a href="/wishlist">관심상품</a><a href="/admin">운영자 관리</a></div><small>© 2026 SOMIMALL</small></footer>
    </main>
    <nav className="bottomnav"><a href="/"><House/>홈</a><a href="/category"><Grid2X2/>카테고리</a><a href="/wishlist"><Heart/>찜</a><a href="/cart"><ShoppingBag/>장바구니</a><a href="/account"><UserRound/>마이</a></nav>
  </>
}
