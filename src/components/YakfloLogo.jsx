// src/components/YakfloLogo.jsx
// 브랜드 가이드 v1.0 컨셉 A — 플로 스트림 (Flow Stream)
//   두 줄기 흐름이 중앙 약품 노드에서 만나는 '통합'의 표현
import { useId } from 'react'

export default function YakfloLogo({ size = 40, variant = 'gradient' }) {
  /* variant:
     - 'gradient' (기본): 보라→녹색 그라데이션 + 양 끝 보라/녹색 점 (라이트 배경용)
     - 'on-dark':         라벤더→흰색 그라데이션 + 라벤더/흰색 점 (다크 헤더용)
  */
  const id = useId()
  const fg = `fg-${id.replace(/:/g, '')}`

  if (variant === 'on-dark') {
    /* 다크 헤더용 — 가이드 'DARK 모드' 변형: 라벤더 #BFA6D9 + 흰색 */
    return (
      <svg width={size} height={size} viewBox="0 0 80 80" fill="none"
           style={{ flexShrink: 0, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
           aria-label="약플로 로고">
        <defs>
          <linearGradient id={fg} x1="0" y1="0" x2="80" y2="80">
            <stop offset="0%" stopColor="#BFA6D9" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
        </defs>
        <path d="M14 26 C30 26, 30 40, 46 40 S62 54, 66 54"
              stroke={`url(#${fg})`} strokeWidth="8" strokeLinecap="round" />
        <path d="M14 54 C30 54, 30 40, 46 40"
              stroke="#BFA6D9" strokeWidth="8" strokeLinecap="round" opacity="0.55" />
        <circle cx="14" cy="26" r="6" fill="#BFA6D9" />
        <circle cx="66" cy="54" r="6" fill="#ffffff" />
        <circle cx="46" cy="40" r="7.5" fill="#2E4A62" stroke="#ffffff" strokeWidth="3.5" />
      </svg>
    )
  }

  /* 기본 (라이트 배경) — 가이드 'PRIMARY 라이트': 보라→녹색 + 양 끝 점 */
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none"
         style={{ flexShrink: 0 }}
         aria-label="약플로 로고">
      <defs>
        <linearGradient id={fg} x1="0" y1="0" x2="80" y2="80">
          <stop offset="0%" stopColor="#804A87" />
          <stop offset="100%" stopColor="#019748" />
        </linearGradient>
      </defs>
      <path d="M14 26 C30 26, 30 40, 46 40 S62 54, 66 54"
            stroke={`url(#${fg})`} strokeWidth="7" strokeLinecap="round" />
      <path d="M14 54 C30 54, 30 40, 46 40"
            stroke="#019748" strokeWidth="7" strokeLinecap="round" opacity="0.55" />
      <circle cx="14" cy="26" r="5.5" fill="#804A87" />
      <circle cx="66" cy="54" r="5.5" fill="#019748" />
      <circle cx="46" cy="40" r="6.5" fill="#ffffff" stroke={`url(#${fg})`} strokeWidth="3.5" />
    </svg>
  )
}
