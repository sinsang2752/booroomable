// 프레임 없는(frame:false) Electron 창은 기본 닫기 버튼이 없어서 직접 만든다.
// 드래그는 별도 손잡이 없이 #root의 빈 여백 자체가 담당한다(index.css의
// -webkit-app-region: drag/no-drag 참고) — 화면 위에 뭔가 튀어나와 보이는 걸 최소화하기 위해
// 여기서는 정말 필요한 닫기 버튼 하나만 아주 옅게 띄워둔다.
export function WindowChrome() {
  return (
    <button type="button" className="app-close-button" onClick={() => window.close()} title="닫기" aria-label="닫기">
      ×
    </button>
  );
}
