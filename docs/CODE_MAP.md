# 코드 지도 (CODE_MAP)

작업 전에 이 파일로 위치를 찾고, **필요한 파일의 줄 범위만** 읽는다(통독·전체 검색 금지). `파일:줄`은 export 선언 위치. 줄 수는 생성 시점(2026-10-01, 주문내역 훈수 추가 후) 기준이라 조금 어긋날 수 있으니 `grep -n 이름 파일`로 재확인한다.

## 읽기·검색 제외 (큰 데이터, `.ignore`로 검색에서 뺌)
| 파일 | 크기 | 안전한 조회법 |
|---|---|---|
| `data/brands/brand-master.csv` | 3,759행 | 열 이름 `head -1`, 한 브랜드 `grep -n "^브랜드명," `; 분포는 python/awk 스크립트로 |
| `data/brands/brand-master.xlsx` | 바이너리 | csv와 동일 내용, 열지 말 것 |
| `src/server/roast/brands.json` | 1.1MB | csv에서 `scripts/build-brands.mjs`로 생성됨. 직접 읽지 말고 csv 기준으로 수정 후 재생성 |
| `supabase/migrations/…0010_color_names_korean.sql` | 1,948줄 | 색상 이름 일괄 변환용, 볼 일 없음 |
| `package-lock.json`, `src/lib/supabase/database.types.ts`(832줄, 생성) | | 필요한 테이블만 `grep -n -A20 "테이블명"` |

## 핵심 영역 길잡이
- **훈수(/roast)**: 화면 `src/components/roast/roast-view.tsx`, 서버 `src/server/roast/`. 평가 엔진은 `src/server/roast/fl/`(2026-10-11 전면 교체, 옛 score/compose/report/questions/texts 등은 삭제): 특징 `feat.ts`(`features`) → 52개 유형 `types.ts`(`TYPE_DEFS`, 판정 `FITNESS`, 평가 기준 `RULES`) → 항목 점수 `axes.ts`(`computeAxes`: c 일관성·t 안목·b 균형·f 핏·x 개성/구매 규율) → `engine.ts`(`evaluate`: 유형 최대 4개 섞기·비중·보너스 A/B·감점(흔한 옷장·핏 실패), 표시 점수 31+69×(원점수/100)^1.35) → 대화·결과 `script.ts`(`buildPlan`/`buildReport`), 특수 질문 `special.ts`(`buildSpecials`: 브랜드 퀴즈·밴드·언더아머·짱구·침착맨·패셔너블만 남김, 문구 `special-texts.ts`), 실행 `run.ts`(`runEvaluation`/`planOf`/`resultOf`). 설계 기본값 `config.ts`(`DEFAULT_CONFIG`, `TALK_BLOCKS`/`REPORT_BLOCKS`), 저장·검사 `store.ts`(roast_text_edits의 `fl.<구역>~n` JSON 행, `applyEdits`/`sanitizeSection`/`VARS`). 입력 준비 `analyze.ts`(`prepare`·`Item`만), 퀴즈 문제 `quiz.ts`(`QUIZ`), 밴드 `bands.ts`. 서버 액션 `actions.ts`(`startRoast`/`finishRoast`). 테스트 `fl/engine.test.ts`(페르소나 8개).
- **무신사 주문내역 훈수(/roast/orders, 메뉴 없음)**: 화면 `src/app/(app)/roast/orders/page.tsx` → `roast-view.tsx`(`orders` prop) + 붙여넣기·로딩 `src/components/roast/order-roast.tsx`(`OrderPaste`, 북마크 안내는 주문 가져오기와 같은 `garment-form/order-guide.tsx`의 `OrderGuide`, 사진은 `/api/imports/{id}/image` 프록시 주소). 서버 액션 `src/server/roast/order-actions.ts`(`startOrderRoast`/`finishOrderRoast`, 저장·AI 없음). 주문내역은 같은 엔진(`fl/`)을 mode "orders"로 돌린다(`order-actions.ts`, 입력 `orders/input.ts`의 `toGarments`, 반품·하트 `orders/context.ts`). 화면 문구는 `fl/screen.ts`(`ORDER_SCREEN`). 상품 하트·후기 수는 `parsers/musinsa.ts`(`popularityIn`), 주문 나누기는 `musinsa-orders.ts`(`parseOrdersForRoast`). 메뉴·노트 공개는 `src/lib/features.ts`의 `orderRoastMenu`.
- **SPA 분리(2026-10-03)**: 브랜드 그룹 `spa`(positions SPA)와 `mass`(매스마켓)를 나눔(`brands.ts` `BRAND_GROUPS`). 패턴 `group_spa`(`lines.ts`), 질문 `spa_why`(`questions.ts`, 점수 `SCORE_DELTAS.spa_why`), 결과 진단 `report-text.ts` `diag.spa`(`report.ts`에서 SPA 브랜드명 `{brands}`를 넣음). 점수의 대중·SPA 제외 조건은 `mass`나 `spa` 둘 다 본다.
- **관리자 훈수 설계**: 페이지 `src/app/(app)/admin/roast-texts/page.tsx` → `src/components/admin/roast-designer.tsx`(`RoastDesigner`, 탭: 전체 구조·패션 유형·점수 기준·공통 문장·특수 질문·패션 퀴즈·화면 문구, 구역마다 `useSection`으로 저장/기본값 되돌리기). 설명 자료 `src/server/roast/fl/admin-meta.ts`(`designerData`: 자리 이름·문장이 쓰이는 곳), 저장 `src/server/roast/admin-actions.ts`(`saveDesignSection`/`resetDesignSection`).
- **브랜드 데이터**: csv → `scripts/build-brands.mjs` → `brands.json` → `src/server/roast/brands.ts`(`findBrand`, `normalizeBrand`, `BRAND_GROUPS`). 무신사 수집 스크립트 `scripts/musinsa/`.
- **핏 계산**: `src/lib/fit/compute.ts`(`computeFit`/`computeSize`), 내 치수 기반 `body-fit.ts`(`FIT_GROUPS`), 길이 `length-fit.ts`, 신발 `shoes.ts`, VS 비교 `versus.ts`, 비교 대상 선택 `select-comparables.ts`, 서버 `src/server/fit/service.ts`, AI 설명 `src/server/ai/fit-interpreter.ts`.
- **구매 판단기(핏체크)**: 화면 `src/components/fit-check/`(`fit-check-view`, `fit-result-view`, `versus-view`), API `src/app/api/fit-checks`, 링크 파싱 `src/server/import/`(`parsers/`, `registry.ts`, `service.ts`).
- **무신사 주문 가져오기**: `src/server/import/musinsa-orders.ts`, `src/lib/import/`, 화면 `src/components/garment-form/order-import-view.tsx`, 북마크 안내 `order-guide.tsx`(`OrderGuide`, 주문내역 훈수와 같이 씀). 옷장 훈수는 이름·나이 뒤 `Chat`이 "옷을 전부 넣었나요?" 질문(`READY_*` 문장, 3번째는 종료+"옷장에 옷 추가하기" 링크)을 먼저 하고, 시작 화면 `Intro`는 동의 체크(`CONSENT`·`CONSENT_WARN`, 맨 처음 옷장 훈수 시작 화면에만 있고 주문내역 시작 화면에는 없음)가 있어야 시작되며 `Typed`는 `**굵게**`·`!!붉은 글씨!!` 표시를 지원한다. 훈수 결과 맨 아래 "분석한 제품 전부 옷장에 넣기"(`roast-view.tsx`)는 `/wardrobe/import-orders?from=roast`로 가며, 훈수가 읽은 결과를 `src/lib/import/order-handoff.ts`로 넘겨 재조회 없이 확인 화면을 연다(`order-import-view.tsx`의 `applyLookup`).
- **옷장/분석**: `src/components/wardrobe/`, `src/server/garments/`, `src/components/analysis/wardrobe-analysis.ts`.
- **업데이트 노트**: `src/lib/release-notes.ts`(342), 화면 `src/components/layout/release-notes-dialog.tsx`. (버전·노트는 사용자 지시 없이 수정 금지)
- **DB**: `supabase/migrations/`(번호순), 스펙 `PROJECT_SPEC.md`(1189줄, 필요한 절만 `grep -n "^#"`로 찾기).

## 파일별 export 목록 (이름:줄)

### src
- `proxy.ts` (29줄) proxy:6 config:25

### src/app
- `error.tsx` (9줄) RootError:6
- `global-error.tsx` (19줄) GlobalError:4
- `layout.tsx` (55줄) metadata:31 RootLayout:38
- `not-found.tsx` (17줄) metadata:4 NotFound:6

### src/app/(app)
- `error.tsx` (9줄) AppError:6
- `layout.tsx` (95줄) AppLayout:27

### src/app/(app)/admin
- `page.tsx` (16줄) metadata:6 AdminPage:9

### src/app/(app)/admin/roast-texts
- `page.tsx` (16줄) RoastDesignPage

### src/app/(app)/analysis
- `page.tsx` (8줄) metadata:3 AnalysisPage:5

### src/app/(app)/body
- `page.tsx` (9줄) metadata:3 BodyPage:6

### src/app/(app)/fit-check
- `page.tsx` (8줄) metadata:3 FitCheckPage:5

### src/app/(app)/fit-check/[id]
- `page.tsx` (61줄) metadata:8 FitCheckResultPage:11

### src/app/(app)/roast
- `layout.tsx` (17줄) RoastLayout:14
- `page.tsx` (13줄) metadata:5 maxDuration:7 RoastPage:9

### src/app/(app)/roast/orders
- `page.tsx` (16줄) metadata:9 OrderRoastPage:11

### src/app/(app)/settings
- `page.tsx` (10줄) metadata:4 SettingsPage:6

### src/app/(app)/wardrobe
- `page.tsx` (15줄) metadata:4 WardrobePage:7

### src/app/(app)/wardrobe/[id]
- `page.tsx` (10줄) metadata:3 GarmentPage:6

### src/app/(app)/wardrobe/import-orders
- `page.tsx` (8줄) metadata:3 OrderImportPage:5

### src/app/(app)/wardrobe/new
- `page.tsx` (14줄) metadata:4 NewGarmentPage:6

### src/app/(public)
- `page.tsx` (44줄) LandingPage:10

### src/app/(public)/privacy
- `page.tsx` (177줄) metadata:5 PrivacyPage:13

### src/app/(public)/terms
- `page.tsx` (76줄) metadata:5 TermsPage:7

### src/app/api/fit-checks
- `route.ts` (51줄) maxDuration:10 POST:14

### src/app/api/health
- `route.ts` (37줄) dynamic:5 GET:11

### src/app/api/imports
- `route.ts` (46줄) maxDuration:9 POST:11

### src/app/api/imports/[id]/image
- `route.ts` (40줄) GET:11

### src/app/api/order-imports/item
- `route.ts` (45줄) maxDuration:12 OrderItemResult:14 POST:23

### src/app/api/usage
- `route.ts` (13줄) dynamic:4 GET:7

### src/app/auth/confirm
- `route.ts` (35줄) GET:14

### src/app/auth/signout
- `route.ts` (26줄) dynamic:6 GET:12

### src/app/auth/update-password
- `page.tsx` (25줄) metadata:8 UpdatePasswordPage:11

### src/components/admin
- `admin-view.tsx` (217줄) AdminView:31
- `roast-designer.tsx` RoastDesigner useSection SaveBar List Structure Blocks Types TypeCard Score Tune Bands AxisLines Common Special Quizzes QuizCard Screen
- `usd-rate-form.tsx` (45줄) UsdRateForm:9
- `user-actions.tsx` (71줄) UserActions:8

### src/components/analysis
- `analysis-view.tsx` (533줄) AnalysisView:34
- `stack-height.ts` (95줄) LANDMARKS thicknessOf formatHeight stackSummary — 옷 전부 쌓은 높이(세부분류별 두께)와 비슷한 높이의 물건
- `stack-art.tsx` (266줄) StackArt — 높이 구간별 그림(코드에 내장, 바로 표시)
- `wardrobe-analysis.ts` (316줄) CategoryTab:8 man:11 won:13 priceComment:56 halfYearAverage:76 recentSixMonths:86 priceSummary:95 monthlySummary:129 …

### src/components/auth
- `auth-mode.ts` (6줄) AuthMode:1 parseAuthMode:3
- `auth-panel.tsx` (247줄) AuthPanel:22 SubmitButton:191 FormMessage:205
- `update-password-form.tsx` (30줄) UpdatePasswordForm:9

### src/components/body
- `body-fit-compare.tsx` (137줄) BodyFitCompare:11
- `body-fit-panel.tsx` (236줄) BodyFitPanel:22
- `body-store.tsx` (101줄) BodyDraft:15 BodyProvider:45 useBody:90 useBodyFit:97
- `body-view.tsx` (689줄) BodyView:46
- `fit-meter.tsx` (85줄) FIT_COLOR:5 FitMeter:20
- `length-silhouette.tsx` (267줄) MALE_BODY_RATIO:7 getMaleBody:24 getTshirt:48 LengthSilhouette:73
- `user-fit-picker.tsx` (34줄) UserFitPicker:9

### src/components/feedback
- `error-panel.tsx` (35줄) ErrorPanel:8
- `offline-banner.tsx` (28줄) OfflineBanner:15
- `wardrobe-skeleton.tsx` (28줄) WardrobeSkeleton:2

### src/components/fit-check
- `fit-check-view.tsx` (581줄) FitCheckView:62
- `fit-result-view.tsx` (541줄) ResultAiStatus:24 FitResultView:154
- `versus-view.tsx` (653줄) MAX_VERSUS:34 VersusView:75

### src/components/garment-form
- `date-label.tsx` (17줄) DateLabel:5
- `garment-fields.tsx` (487줄) FormState:22 Imported:40 EMPTY_FORM:42 importedForm:61 chartMeasurements:79 draftToForm:85 ItemState:105 newItemState:115 …
- `image-picker.tsx` (97줄) ImagePicker:11
- `new-garment-view.tsx` (565줄) extractLinks:38 NewGarmentView:62
- `order-guide.tsx` (179줄) OrderGuide:18
- `order-import-view.tsx` (471줄) OrderImportView:95
- `page-image-grid.tsx` (68줄) PageImageGrid:9
- `shoe-fit-picker.tsx` (29줄) ShoeFitPicker:4
- `shop-photos.tsx` (90줄) ShopPhotos:13

### src/components/held
- `held-section.tsx` (176줄) HeldSection:18
- `use-add-held.ts` (63줄) HeldDraft:7 useAddHeld:14

### src/components/landing
- `feature-showcase.tsx` (706줄) FeatureShowcase:39 — 첫 화면 대표 기능 탭 5개(옷장 관리·구매 판단·패션 훈수·내 치수·옷장 데이터, 자동 넘김 멈춤 버튼 없음, 탭을 누르면 그 기능부터 다시 넘김). 탭 글은 `FEATURES`:637, 예시 화면 WardrobeDemo:246·FitCheckDemo:369·RoastDemo:449·BodyDemo:512·AnalysisDemo:571. 움직임은 `landing.css`(--d 지연, 자동 넘김 막대 animationend로 다음 탭)
- `promo-banner.tsx` (120줄) PromoBanner — 로그인 화면 회원가입 줄 아래 새 기능 알림 배너(클릭 없음)(signin·signup 모드). 항목은 `PROMOS` 목록 한 곳에서 추가·수정, 2개 이상이면 5초마다 왼쪽 밀어내기 전환(`landing.css`의 pb-slide), 마우스·포커스 시 멈춤, 점으로 이동
- `src/components/auth/help-popup.tsx` HelpPopup — 로그인·회원가입 제목 위 빨간 밑줄 안내 + X 달린 팝업(`auth-panel.tsx`에서 사용, 돌고래 사진 `public/images/dolphin.jpg`)
- `service-intro.tsx` (34줄) ServiceIntro:9 — 로그인 화면 왼쪽(제목·소개 한 줄 + FeatureShowcase)

### src/components/layout
- `app-header.tsx` (62줄) AppHeader:20 — 화면 폭 가득한 고정 메뉴바(반투명 회색, `globals.css`의 `.header-bar`). 로고·테마 버튼 없음, 메뉴 좌측 정렬
- 앱 화면 공통 모양(`globals.css` 끝): `.large-title`·`.page-sub` 큰 제목 머리말, `.app-card` 둥근 카드, `.rise` 들어올 때 떠오름
- `release-notes-dialog.tsx` (445줄) ReleaseNotesDialog:30
- `theme-toggle.tsx` (104줄) ThemeToggle:52
- `user-menu.tsx` (251줄) UserMenu:192 MenuBody:15 useFabHidden:75 MobileAccountButton:100 — 계정 메뉴(화면 모드 선택 포함). PC는 상단 바 버튼+드롭다운, 모바일은 우측 하단 동그란 버튼이 메뉴 창으로 펼쳐짐(body로 portal, 아래 스크롤 시 숨김·3초 멈추거나 위로 스크롤 시 표시, `.fab`/`.fab-panel` 애니메이션)

### src/components/legal
- `legal-page.tsx` (41줄) LegalPage:5 LegalSection:23 LegalList:32
- `site-footer.tsx` (21줄) SiteFooter:8

### src/components/roast
- `order-roast.tsx` (198줄) OrderCopy:21 OrderPaste:45
- `roast-view.tsx` (1033줄) RoastView:76(fast prop=관리자 10배 속도, pace.speed). 대화는 말풍선 채팅(`roast.css`: `.roast-ai` 말풍선, `.roast-typing` 입력 중 점, `.roast-replies` 오른쪽 답 칸), `Typed`는 글을 한 번에 띄우고 읽을 틈 뒤 onDone

### src/components/settings
- `settings-view.tsx` (64줄) SettingsView:11

### src/components/ui
- `button.tsx` (29줄) buttonClassName:20 Button:26
- `field.tsx` (34줄) Field:2
- `input.tsx` (20줄) Input:5 UnitInput:10
- `price-input.tsx` (61줄) PriceInput:11

### src/components/usage
- `usage-note.tsx` (63줄) UsageNote:10

### src/components/wardrobe
- `filter-state.ts` (207줄) SortableColumn:8 SortDirection:9 ColumnSort:10 WardrobeFilters:19 DEFAULT_SORT:29 DEFAULT_FILTERS:31 isFiltered:40 nextSort:52 …
- `garment-detail-view.tsx` (28줄) GarmentDetailView:10
- `garment-drawer.tsx` (714줄) GarmentDrawer:76 GarmentDetail:88
- `garment-thumbnail.tsx` (46줄) GarmentThumbnail:11 (fit "natural" = 원래 사진 비율, 표·목록은 이것만 씀)
- `wardrobe-filters.tsx` (118줄) MoreFilters:14(세부분류·브랜드·시즌·컬러, 늘 펼침) SearchBox:87
- `wardrobe-store.tsx` (410줄) GarmentDraft:29 PendingDraft:30 ImageChange:33 SaveResult:36 NETWORK_ERROR:117 WardrobeProvider:137 useOpenGarmentId:381 useWardrobe:385 …
- `wardrobe-table.tsx` (309줄) WardrobeViewMode:17 GarmentSelection:19 WardrobeTable:33
- `wardrobe-view.tsx` (430줄) WardrobeView:36 (머리말: 왼쪽 제목·검색·필터, 오른쪽 보기 방식·새 옷 추가·옷 삭제)

### src/lib
- `account.ts` (3줄) DELETE_CONFIRM_WORD:2
- `cn.ts` (5줄) cn:2
- `features.ts` (13줄) FEATURES:4
- `legal.ts` (13줄) SERVICE_NAME:5 PRIVACY_OFFICER:6 PRIVACY_EFFECTIVE_DATE:10 PRIVACY_HISTORY:11 TERMS_EFFECTIVE_DATE:12
- `release-notes.ts` (395줄) ReleaseFeature:17 ReleaseNote:24 RELEASE_NOTES:315 CURRENT_VERSION:317 majorOf:320 groupByMajor:323 ReleaseNoteContent:338 ReleaseNoteEdits:339 …
- `session-expiry.ts` (36줄) stashDraft:10 takeStashedDraft:19 goToSignIn:30
- `theme.ts` (10줄) ThemeChoice:1 THEME_STORAGE_KEY:3 THEME_INIT_SCRIPT:9
- `usage.ts` (52줄) UsageCounter:6 UnlimitedReason:14 Usage:16 USAGE_WINDOW_MS:27 USAGE_CHANGED_EVENT:30 notifyUsageChanged:31 formatRemaining:34 resetHint:46

### src/lib/constants
- `body.ts` (53줄) BODY_KEYS:6 BodyKey:7 BodyField:9 BODY_FIELDS:20 BODY_LABELS:29 FIT_LEVELS:32 FitLevel:33 WEARABLE_LEVELS:34 …
- `categories.ts` (133줄) CATEGORIES:3 CATEGORY_NAME:11 COUNT_UNIT:20 SUBCATEGORIES:32 SUBCATEGORY_NAME:92 SIMILAR_SUBCATEGORIES:98
- `colors.ts` (313줄) COLOR_HEX:2 normalizeColorName:217 findColorHex:239 luminance:257 colorChip:267 findColorFamily:302
- `measurements.ts` (80줄) TOP_MEASUREMENTS:4 BOTTOM_MEASUREMENTS:5 HAT_MEASUREMENTS:6 MeasurementKey:7 MEASUREMENT_KEYS:13 ALL_MEASUREMENT_KEYS:21 MEASUREMENT_LABELS:25 measurementFields:41 …
- `seasons.ts` (37줄) SEASONS:3 FOUR_SEASONS:12 SEASON_NAME:14 toggleSeason:26 wearsInSeason:34
- `shoe-fit.ts` (30줄) SHOE_FIT_LEVELS:5 ShoeFitLevel:6 ShoeFitKey:7 ShoeFit:8 SHOE_FIT_FIELDS:10 EMPTY_SHOE_FIT:16 shoeFitOrNull:19 shoeFitText:26

### src/lib/fit
- `body-fit.ts` (711줄) WidthKey:22 RecKey:24 Band:25 FitGroupId:27 FitOverrides:41 BodyProfile:46 EMPTY_BODY:54 FIT_GROUPS:74 …
- `client.ts` (60줄) FitDone:5 FitClientError:6 FIT_ERROR_TEXT:8 streamFitCheck:21
- `compute.ts` (339줄) TOLERANCE:23 EXCLUDED_DIMS:45 CORE_DIMS:49 FitCandidate:57 garmentName:75 snapshotComparables:78 ruleSummary:190 computeSize:257 …
- `length-fit.ts` (140줄) LENGTH_LEVELS:10 LengthLevel:11 LENGTH_LEVEL_NAME:12 LengthGroup:20 LENGTH_GROUPS:21 LENGTH_GROUP_NAME:22 Band:24 LengthOverrides:26 …
- `review-signals.ts` (84줄) extractReviewSignals:61 negativeSignalsFor:81
- `schema.ts` (59줄) MAX_FIT_SIZES:8 fitCandidateSchema:21 fitRequestSchema:52 FitRequest:58
- `select-comparables.ts` (79줄) MIN_COMPARABLES:13 MAX_COMPARABLES:14 MIN_SHARED_DIMS:15 measurementKeysFor:17 candidateKeys:23 SelectedComparable:27 Selection:33 selectComparables:40
- `shoes.ts` (118줄) SHOE_STEP_MM:12 shoeSizeMm:15 idealFrom:33 computeShoeSize:41 shoeSizeNote:109
- `types.ts` (130줄) MatchLevel:10 Direction:11 Confidence:12 ReviewSignal:14 ComparableSnapshot:24 ShoeSizeReport:39 RangeStat:49 Verdict:56 …
- `versus.ts` (116줄) VersusSizeRow:12 VersusBasis:17 bodyScore:20 wardrobeScore:27 pickSize:38 VersusEntry:58 VersusRank:66 rankVersus:74 …
- `wording.ts` (69줄) words:36 DIRECTION_WORD:39 hasBatchim:42 eunNeun:50 gwaWa:51 shortLabel:54 cm:58 itemWording:63

### src/lib/format
- `date.ts` (5줄) formatDate:2
- `price.ts` (48줄) Currency:5 CURRENCIES:6 isCurrency:7 DEFAULT_USD_KRW:10 formatPrice:13 priceInKrw:19 krwHint:25 parsePriceInput:31 …

### src/lib/images
- `prepare-image.ts` (67줄) IMAGE_MAX_EDGE:8 THUMB_MAX_EDGE:9 IMAGE_QUALITY:10 SOURCE_MAX_BYTES:12 PreparedImage:14 ImagePrepareError:16 scaledSize:22 prepareGarmentImage:27
- `upload-garment-image.ts` (32줄) GARMENT_IMAGE_BUCKET:4 garmentImagePaths:7 uploadGarmentImages:13

### src/lib/import
- `client.ts` (71줄) streamImport:7 importImageUrl:58 importImageFile:61
- `messages.ts` (45줄) ImportFailureCode:6 IMPORT_FAILURE:22 importFailure:42
- `musinsa-bookmarklet.ts` (36줄) MUSINSA_BOOKMARKLET:35
- `order-duplicates.ts` (65줄) ExistingGarment:11 OrderCandidate:20 goodsNoOf:30 findDuplicates:47
- `order-guide-device.ts` (35줄) GuideDevice:5 guideDevice:15
- `order-handoff.ts` (63줄) OrderLookup:14 OrderHandoff:27 lookupOf:33 saveOrderHandoff:47 takeOrderHandoff:55 hasOrderHandoff:65 (훈수가 읽은 상품 결과를 주문내역으로 추가 화면에 넘김, sessionStorage)

### src/lib/mock
- `garments.ts` (227줄) MOCK_GARMENTS:4

### src/lib/roast
- `bubbles.ts` (31줄) splitSentences:7 joinBubbles:10 bubblesOf:13 isBubbleKey:20
- `copy.ts` (35줄) ROAST_COPY:5 RoastCopy:28 DISCLAIMER:30 MIN_CLOTHES:31 tooFew:32
- `hash.ts` (41줄) wardrobeHash:7
- `types.ts` (119줄) RoastOption:6 RoastPriced:18 RoastQuestion:23 RoastStep:39 RoastScript:46 RoastParagraph:53 RoastReport:59 RoastGarmentRef:87 …

### src/lib/security
- `csp.ts` (27줄) buildCsp:6 createNonce:24

### src/lib/supabase
- `admin.ts` (16줄) createSupabaseAdminClient:10
- `client.ts` (15줄) createSupabaseBrowserClient:11
- `config.ts` (83줄) SupabasePublicEnv:11 getSupabaseEnv:15 normalizeSupabaseUrl:29 isAuthConfigured:39 REMEMBER_COOKIE:44 REMEMBER_MAX_AGE:45 LAST_EMAIL_COOKIE:48 LAST_EMAIL_MAX_AGE:49 …
- `database.types.ts` (833줄) Json:2 Database:10 Tables:704 TablesInsert:733 TablesUpdate:758 Enums:783 CompositeTypes:800 Constants:817
- `proxy.ts` (65줄) updateSession:9
- `server.ts` (56줄) createSupabaseServerClient:11 getCurrentUser:38 getActiveUser:48 isBanned:53

### src/lib/types
- `domain.ts` (49줄) CategoryId:6 FitCategoryId:8 Season:10 Measurements:13 Garment:16 GarmentListItem:48

### src/server
- `usage.ts` (36줄) getUsage:16

### src/server/account
- `actions.ts` (39줄) DeleteAccountState:12 deleteMyAccount:18
- `delete.ts` (35줄) deleteAccountAndData:11

### src/server/admin
- `actions.ts` (104줄) AdminActionResult:15 setUserBanned:37 setUserTester:53 deleteUserAccount:70 setUsdRate:84
- `audit.ts` (15줄) AdminAuditAction:5 logAdminAction:11
- `guard.ts` (31줄) getAdminUser:9 isAdmin:18 requireAdmin:26
- `is-admin.ts` (26줄) hasAdminRow:9 getQuotaExemption:18
- `queries.ts` (135줄) ADMIN_USERS_PER_PAGE:8 AdminStats:10 ImportFailure:25 AdminUserRow:32 AdminOverview:47 AdminOverviewError:56 getAdminOverview:63

### src/server/ai
- `fit-interpreter.ts` (281줄) PROMPT_VERSION:17 buildFitInput:110 inputHash:172 validateInterpretation:223 interpretFit:268
- `gemini.ts` (93줄) DEFAULT_GEMINI_MODEL:10 extractJson:40 geminiProvider:56
- `mock.ts` (41줄) mockProvider:9
- `provider.ts` (80줄) StructuredRequest:12 AiProvider:24 DEFAULT_MODEL:36 AiError:38 getAiProvider:71

### src/server/auth
- `actions.ts` (140줄) AuthFormState:11 signIn:51 signUp:77 requestPasswordReset:101 updatePassword:116 signOut:134
- `messages.ts` (13줄) AUTH_MESSAGES:1
- `signup-notify.ts` (44줄) notifyAdminOfSignup — 가입 인증 직후 관리자에게 알림 메일(env: ADMIN_NOTIFY_EMAIL·NOTIFY_SMTP_USER·NOTIFY_SMTP_PASS, 없으면 건너뜀). `auth/confirm/route.ts`에서 호출
- `schemas.ts` (44줄) signInSchema:6 signUpSchema:11 resetRequestSchema:26 updatePasswordSchema:28 fieldErrors:36

### src/server/body
- `actions.ts` (116줄) BodyActionResult:16 saveBodyProfile:37 saveFitOverrides:80 deleteBodyProfile:102
- `crypto.ts` (62줄) BodyValues:11 BodyKeyMissingError:15 hasBodyKey:28 encryptBodyValues:38 decryptBodyValues:51
- `queries.ts` (72줄) BodyRow:9 LEGACY_BODY_COLUMN:15 clearLegacyColumns:24 legacyValues:30 rowToBody:40 getMyBodyProfile:55
- `schema.ts` (44줄) bodyInputSchema:18 BodyInput:24 overridesSchema:40

### src/server/fit
- `service.ts` (145줄) FIT_DAILY_LIMIT:20 AI_DAILY_LIMIT_DEFAULT:21 AI_CACHE_DAYS:22 CACHE_SUFFIX:23 FitErrorCode:27 FitStreamEvent:29 hoursAgo:34 aiDailyLimit:36 …

### src/server/garments
- `actions.ts` (260줄) GarmentActionResult:17 createGarment:87 updateGarment:110 deleteGarment:131 restoreGarment:135 deleteGarments:166 restoreGarments:170 setGarmentImage:221
- `mapper.ts` (141줄) GarmentRow:9 GARMENT_COLUMNS:13 GarmentListRow:16 rowToGarment:73 inputToRow:106
- `queries.ts` (37줄) SIGNED_URL_SECONDS:9 withImageUrls:14 listMyGarments:26
- `schema.ts` (121줄) garmentInputSchema:38 GarmentInput:111 garmentIdSchema:120

### src/server/import
- `ai-size-chart.ts` (73줄) aiSizeChart:50
- `analyze.ts` (101줄) AnalyzeStage:15 AnalyzeResult:17 siteOf:32 analyzeProductUrl:43
- `context.ts` (36줄) extractJsonLd:5 createParseContext:33
- `fetcher.ts` (199줄) FETCH_LIMITS:16 USER_AGENT:17 FetchedPage:19 FetchOptions:27 safeFetch:45 IMAGE_MAX_BYTES:51 safeFetchImage:52
- `musinsa-orders.ts` (249줄) ORDER_STATUSES:11 MusinsaOrder:14 OrderGarment:24 ParsedOrders:35 GOODS_MARK_RE:48 parseMusinsaOrders:55 optionPairs:111 packCount:133 …
- `musinsa-search.ts` (119줄) SearchCandidate:8 SearchResult:16 searchKeyword:33 matchScore:48 scanGoods:61 searchMusinsa:96
- `registry.ts` (78줄) siteParsers:13 platformParsers:14 selectParsers:16 ParserRun:31 runParsers:43
- `service.ts` (161줄) IMPORT_REUSE_MINUTES:18 IMPORT_DAILY_LIMIT:19 ORDER_IMPORT_DAILY_LIMIT:20 ORDER_IMPORT_SUFFIX:21 ORDER_ROAST_DAILY_CAP:26 ORDER_ROAST_SUFFIX:27 IMPORT_ENGINE_VERSION:29 ImportOutcome:33 …
- `types.ts` (142줄) ParseContext:9 RawSizeChart:19 ProductPopularity:27 RawProduct:32 RawField:53 ProductParser:55 ImportWarningCode:65 ImportWarning:74 …
- `url.ts` (23줄) MAX_URL_LENGTH:7 normalizeProductUrl:10

### src/server/import/normalize
- `category.ts` (80줄) mapCategory:63
- `color.ts` (40줄) splitColorOption:14 cleanOptions:22 pickColor:32
- `index.ts` (143줄) FieldSources:12 cleanProductName:33 MAX_IMAGES:46 dedupeImages:49 NormalizeOptions:67 normalizeProduct:73
- `size-chart.ts` (132줄) mapHeader:36 normalizeSizeChart:72
- `text.ts` (15줄) cleanText:4 textOrUndefined:14

### src/server/import/parsers
- `cafe24.ts` (86줄) cafe24Parser:21
- `generic.ts` (130줄) genericParser:46
- `helpers.ts` (136줄) absoluteUrl:8 tableToRaw:19 findSizeTable:44 selectOptions:59 imagesIn:95 blockText:114 meta:134
- `musinsa.ts` (354줄) musinsaGoodsNo:24 cleanMusinsaTitle:29 extractAssignedJson:39 scanImageUrls:117 scanStateImages:126 actualSizeToChart:171 popularityIn:215 musinsaParser:250
- `shopify.ts` (65줄) shopifyParser:26
- `size-text.ts` (179줄) sizeChartFromText:130 sizeTableInEmbeddedHtml:144 sizeSnippet:166

### src/server/release-notes
- `actions.ts` (138줄) ReleaseNoteEditResult:22 getReleaseNoteEdits:32 saveReleaseNoteEdit:63 resetReleaseNoteEdit:80 getReleaseNoteImages:92 ReleaseNoteImageResult:104 saveReleaseNoteImage:107 removeReleaseNoteImage:126

### src/server/roast
- `actions.ts` startRoast finishRoast
- `admin-actions.ts` DesignResult saveDesignSection resetDesignSection
- `analyze.ts` ACHROMATIC MIN_GARMENTS FIT_WORD Item brandKindOf colorCounted prepare shopOf
- `bands.ts` Band BANDS bandOf findBand
- `brands.ts` BrandInfo BRANDS MUSINSA_POPULAR BrandGroup BRAND_GROUPS GROUP_WORD normalizeBrand isTrueHeritage …
- `keywords.ts` FAMILIES FamilyId FAMILY_IDS familyName productFamilies
- `order-actions.ts` beginOrderRoast orderRoastUsed startOrderRoast finishOrderRoast (하루 1회)
- `order-limit.ts` kstDayStart orderRoastUsedToday
- `queries.ts` getLatestRoast signGarments getRoastTextEdits getFlConfig
- `quiz.ts` QuizEntry QUIZ PickedQuiz pickQuiz
- `text.ts` josa won Vars MissingVar fill varsOf rng Rng

### src/server/roast/fl
- `feat.ts` Mode Feat features
- `types.ts` AxisKey AXIS_NAME AXIS_KEYS BASE_WEIGHTS RULES RuleId GROUP_NAME Grade TypeLines TypeDef ramp FITNESS TYPE_DEFS TYPE_BY_ID
- `axes.ts` AxisOut computeAxes (표본 30벌 미만은 0.5 쪽으로 당김)
- `engine.ts` ActiveType Bonus Penalty Evaluation evaluate displayScore (BONUS_GATE: 스트릿·신발·원브랜드 보너스 조건)
- `config.ts` TypeConf Block FlConfig TALK_BLOCKS REPORT_BLOCKS DEFAULT_CONFIG
- `store.ts` VARS checkSentence sanitize* CUSTOM_QUIZ_ID sanitizeSection isSection toRows fromRows applyEdits
- `script.ts` buildPlan buildReport tierOf
- `special.ts` AskedQuestion twinsOf buildSpecials · `special-texts.ts` QuestionText SPECIAL_Q_TEXT
- `vars.ts` typeVars · `screen.ts` ORDER_SCREEN · `run.ts` MIN_CLOTHES runEvaluation planOf resultOf · `admin-meta.ts` designerData DesignerData

### src/server/roast/orders
- `context.ts` OrderPop OrderEvent OrderContext
- `input.ts` orderItemSchema OrderRoastItem orderListSchema measurementsOf toGarments

### src/server/security
- `url-guard.ts` (89줄) isBlockedIp:56 ALLOWED_PORTS:67 UrlCheck:69 checkUrlShape:72

### src/server/settings
- `queries.ts` (20줄) getUsdRate:9
