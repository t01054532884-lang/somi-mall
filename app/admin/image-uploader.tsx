'use client';
import { useState } from 'react';

export default function ImageUploader({value='',positionX=50,positionY=50}:{value?:string;positionX?:number;positionY?:number}){
  const [url,setUrl]=useState(value),[x,setX]=useState(positionX),[y,setY]=useState(positionY),[message,setMessage]=useState('');
  async function upload(file:File){
    setMessage('업로드 중…');
    const form=new FormData();form.set('file',file);
    const response=await fetch('/api/admin/upload',{method:'POST',body:form});
    const body=await response.json() as {url?:string;error?:string};
    if(response.ok&&body.url){setUrl(body.url);setMessage('업로드했습니다. 자르기 위치를 맞춘 뒤 상품을 저장하세요.')}else setMessage(body.error??'업로드하지 못했습니다.');
  }
  return <div className="field admin-wide image-standard-field">
    <label>상품 목록 대표 이미지<input name="imageUrl" type="url" required placeholder="이미지 주소를 붙여넣거나 파일을 선택하세요" value={url} onChange={e=>setUrl(e.target.value)}/></label>
    <div className="image-standard-grid">
      {url?<img src={url} alt="목록 이미지 자르기 미리보기" style={{objectPosition:`${x}% ${y}%`}}/>:<div className="image-placeholder">650 × 867</div>}
      <div><b>원본을 올리고 보이는 위치를 맞추세요</b><p>목록의 650 × 867 세로 프레임 안에서 사진을 자르지 않고 초점 위치만 저장합니다.</p>
        <input className="file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file)}}/>
        <label className="crop-range">좌우 위치 <input name="imagePositionX" type="range" min="0" max="100" value={x} onChange={e=>setX(Number(e.target.value))}/><output>{x}%</output></label>
        <label className="crop-range">상하 위치 <input name="imagePositionY" type="range" min="0" max="100" value={y} onChange={e=>setY(Number(e.target.value))}/><output>{y}%</output></label>
        <small>{message||'JPG, PNG, WEBP · 최대 8MB'}</small>
      </div>
    </div>
  </div>;
}

export function DetailImageUploader({value=[]}:{value?:string[]}){
  const [urls,setUrls]=useState(value),[message,setMessage]=useState('');
  async function upload(files:FileList){setMessage('상세 이미지 업로드 중…');const next=[...urls];for(const file of Array.from(files).slice(0,12-urls.length)){const form=new FormData();form.set('file',file);const response=await fetch('/api/admin/upload',{method:'POST',body:form});const body=await response.json() as {url?:string;error?:string};if(!response.ok||!body.url){setMessage(body.error??'업로드하지 못했습니다.');return}next.push(body.url)}setUrls(next);setMessage(`${next.length}장의 상세 이미지가 준비됐습니다.`)}
  return <div className="field admin-wide detail-upload"><label>상세 이미지 <small>가로 1000px 이상, 세로 길이 자유</small><input className="file-input" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>{if(e.target.files)void upload(e.target.files)}}/></label><input type="hidden" name="detailImages" value={JSON.stringify(urls)}/>{urls.length?<div className="admin-detail-thumbs">{urls.map((url,index)=><figure key={url}><img src={url} alt={`상세 이미지 ${index+1}`}/><figcaption>{index+1}</figcaption><button type="button" onClick={()=>setUrls(current=>current.filter(item=>item!==url))}>삭제</button></figure>)}</div>:null}<small>{message||'노출 순서대로 최대 12장입니다. 같은 폭으로 제작하면 상세 페이지가 자연스럽게 이어집니다.'}</small></div>;
}
