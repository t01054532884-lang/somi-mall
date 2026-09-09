import type { Metadata } from 'next';
import './globals.css';
import './detail.css';
export const metadata:Metadata={title:'소미몰 | 취향을 발견하는 쇼핑',description:'매일 입고 싶은 스타일. 소미몰 패션 셀렉트숍 프리뷰.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>}
