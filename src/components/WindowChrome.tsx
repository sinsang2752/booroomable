// 프레임 없는(frame:false) Electron 창은 기본 닫기 버튼이 없어서 직접 만든다.
// 드래그는 별도 손잡이 없이 #root 상단의 여백 자체가 담당한다(index.css의
// -webkit-app-region: drag/no-drag, #root padding 참고). 닫기 버튼은 그 여백 안
// 우측에 작게, 빨간 배경으로 항상 보이게 띄워둔다.
export function WindowChrome() {
  return (
    <button type="button" className="app-close-button" onClick={() => window.close()} title="닫기" aria-label="닫기">
      ×
    </button>
  );
}
