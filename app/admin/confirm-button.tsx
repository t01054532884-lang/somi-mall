'use client';

/** 누르기 전에 한 번 더 묻는 제출 버튼 (삭제용). */
export default function ConfirmButton({ message, children }: { message: string; children: React.ReactNode }) {
  return (
    <button
      className="ops-link"
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
