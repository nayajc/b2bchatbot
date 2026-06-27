# Deep Interview Spec: B2B 입장권 재판매 — 여행사 대상 AI FAQ 챗봇

## Metadata
- Interview ID: di-b2b-ticket-chatbot-2026-06-27
- Rounds: 8 (+ Round 0 topology)
- Final Ambiguity Score: 15%
- Type: greenfield
- Generated: 2026-06-27
- Threshold: 0.2
- Threshold Source: default
- Initial Context Summarized: no
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.88 | 0.40 | 0.352 |
| Constraint Clarity | 0.82 | 0.30 | 0.246 |
| Success Criteria | 0.85 | 0.30 | 0.255 |
| **Total Clarity** | | | **0.853** |
| **Ambiguity** | | | **0.147 (15%)** |

## Topology
| Component | Status | Description | Coverage / Deferral Note |
|-----------|--------|-------------|--------------------------|
| 지식베이스 (Knowledge Base) | active | FAQ/팩트시트를 RAG 소스로 구축·관리 | 원본 형식 미정 → 구조화 취합 필요(오픈이슈). 영어. |
| AI답변엔진 (AI Q&A / RAG) | active | KB 기반 자동 답변, 출처 표기 | Phase 1 = 정적 FAQ만. 실시간/거래성 질문 제외 |
| 상담원연결 (Human Handoff) | active | 미해결/중요 질문을 직원에게 전달 | 이메일/티켓 생성(비동기) |
| 채널 (Channel) | active | 여행사 질문 입력 창구 | 자체 웹/포털 내 위젯 |
| 운영분석 (Ops & Analytics) | active | 미응답·품질 로그로 KB 개선 | 파일럿에서 미응답 로그 수집 필수 |

## Goal
국내 입장권을 해외/영어권 여행사(B2B)에 재판매하는 사업에서, 여행사 직원들의 반복적 문의(가격·수수료·정산, 상품/이용 안내 등 정적 정보)를 **자체 웹/포털에 탑재한 영어 AI 챗봇(RAG)**이 자동 응답하고, 챗봇이 답할 수 없는 실시간·거래성·불확실 질문은 **이메일/티켓으로 직원에게 에스컬레이션**하여 직원의 반복 응대 부담을 줄인다.

## Constraints
- 언어: **영어 전용** (멀티링구얼 불필요)
- 채널: 여행사용 **자체 웹/포털 내 위젯** (신규 창구 아님)
- 범위(Phase 1): **정적 FAQ/팩트시트 기반 답변만** 자동화
- 안전장치: 답변 시 **근거 출처(FAQ/문서) 표기**, 불확실하면 직원 연결 제안 (오답 최소화 — B2B 금전 리스크)
- 에스컬레이션: **이메일/티켓 생성**(비동기). 실시간 라이브채팅 불필요
- KB 원본 형식 미정 → 인덱싱 전에 구조화 취합 필요

## Non-Goals (Phase 1 제외)
- 실시간 재고/가용여부 자동 조회 → 사람으로 연결
- 예약/발권 등 거래성 트랜잭션 처리 → 사람으로 연결
- 시스템(재고/예약 API·DB) 연동
- 라이브 채팅(상담원 실시간 인계)
- 한국어 외 다국어(영어 외) 지원

## Acceptance Criteria
- [ ] 영어로 핵심 FAQ 20~30개 범위의 질문에 출처를 표기하여 자동 답변한다
- [ ] 전체 문의의 **약 50%를 사람 개입 없이 자동 처리**한다 (1차 KPI)
- [ ] KB에 없거나 불확실한 질문은 추측하지 않고 이메일/티켓으로 직원에게 에스컬레이션한다
- [ ] 실시간 재고·예약/발권 질문은 자동 답변하지 않고 직원 연결로 라우팅한다
- [ ] 모든 자동 답변에 근거 출처가 표시된다
- [ ] 자체 웹/포털 내 위젯으로 동작한다
- [ ] 미응답/에스컬레이션 질문이 로그로 수집되어 KB 개선에 활용된다
- [ ] 보조지표 측정: 직원 응대시간 절감, 응답 속도(즉시), 답변 정확도/만족도

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| 챗봇이 모든 질문에 답해야 한다 | 재고/예약은 정적 FAQ로 불가 (Round 2) | Phase 1은 정적 FAQ만, 실시간·거래는 사람 연결 (Round 3) |
| 목표는 "답을 잘하는 것" | Contrarian: 진짜 목표는 부담 감소 아닌가? (Round 4) | 1차 KPI = 자동처리율, 보조 = 응대시간/속도/정확도 |
| 복잡한 에스컬레이션 필요 | Simplifier: 가장 단순한 방식은? (Round 6) | 이메일/티켓 생성(비동기)로 충분 |
| 다국어 지원 필요 | 대상 고객 언어는? (Round 7) | 영어 전용 |

## Technical Context (greenfield)
- 아키텍처: **RAG (검색증강생성)** + 에스컬레이션. 외부 시스템 연동 없음.
- 권장 스택 방향: Claude(최신 모델, 예: Claude Opus 4.8 / Sonnet 4.6) + 벡터 검색(임베딩) 위에 출처 인용형 답변. 위젯은 자체 포털에 임베드.
- KB 파이프라인: 흩어진 FAQ/팩트시트 → 구조화(문서/엑셀) → 청킹·임베딩 → 인덱스.
- 미응답 로그 수집/리뷰 루프 필수 (KB 점진 확장).

## Ontology (Key Entities)
| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| TravelAgency (여행사) | core domain | id, name, language(EN), portal_account | asks many Questions |
| Question (질문) | core domain | text, type(price/inventory/info/booking), timestamp | belongs to Conversation; may yield Escalation |
| Answer (답변) | core domain | text, sources[], confidence | answers Question; cites KBItem |
| KBItem (FAQ/팩트시트) | core domain | title, content, source_doc | grounds Answers |
| Staff (직원) | supporting | id, email | handles Escalation |
| Escalation (티켓) | core domain | question_ref, status, channel(email) | created from Question; assigned to Staff |
| Conversation (대화) | supporting | id, agency_ref, messages[] | groups Questions |
| Channel (채널) | external/surface | type(web portal widget) | hosts Conversation |

## Ontology Convergence
| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 8 | 8 | - | - | N/A |
| 2-8 | 8 | 0 | 0 | 8 | 100% |

엔티티는 Round 1에서 즉시 안정화되어 8개 모델이 변동 없이 수렴 — 도메인 모델이 견고함.

## Open Items
- KB 원본을 어떤 구조(엑셀/문서)로 취합할지 — 인덱싱 전 결정 필요
- 자체 포털의 기술 스택(임베드 방식) 확인 필요
- 자동처리율 50% 등 목표 수치의 베이스라인은 파일럿 후 보정

## Interview Transcript
<details>
<summary>Full Q&A (8 rounds)</summary>

- R0 Topology: 5개 컴포넌트(지식베이스/AI답변엔진/상담원연결/채널/운영분석) 확인 → 모두 채택
- R1 채널: 현재 이메일/전화 문의, 챗봇은 자체 웹/포털에 탑재
- R2 질문유형: 가격/수수료/정산, 재고/가용여부, 상품/이용안내, 예약/발권 (전부)
- R3 실시간처리: 일단 사람으로 연결 (Phase 1 = 정적 FAQ만)
- R4 [Contrarian] 성공지표: 자동처리율, 응대시간 절감, 즉시응답, 정확도/만족도
- R5 오답안전: 답변+출처 표기, 애매하면 연결
- R6 [Simplifier] 에스컬레이션: 이메일/티켓 생성
- R7 KB형식: 미정(취합 필요) / 언어: 영어 전용
- R8 파일럿: 핵심 FAQ 20~30개, 자동처리율 50% 목표

</details>
