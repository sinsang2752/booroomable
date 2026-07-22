# booroomable

부루마블/모두의마블 스타일의 방치형 턴제 멀티플레이어 보드게임. 데스크톱 하단에 배치되는 위젯 형태를 목표로 하는 1인 개발(바이브코딩) 프로토타입입니다.

자세한 게임 규칙, 로드맵, DB 스키마 등은 [CLAUDE.md](./CLAUDE.md)를 참고하세요.

## 현재 단계

**1단계 — 로컬 패스앤플레이 프로토타입.** 네트워킹 없이 한 화면에서 2~4명이 턴을 번갈아 하며 게임 규칙을 검증합니다.

## 기술 스택

- Vite + React + TypeScript

## 시작하기

```bash
npm install
npm run dev
```

## 스크립트

- `npm run dev` — 개발 서버 실행
- `npm run build` — 타입 체크 후 프로덕션 빌드
- `npm run preview` — 빌드 결과 미리보기
- `npm run lint` — Oxlint 실행
