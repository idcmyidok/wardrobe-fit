# 코드 지도 (CODE_MAP)

작업 전에 이 파일로 위치를 찾고, **필요한 파일의 줄 범위만** 읽는다(통독·전체 검색 금지). `파일:줄`은 export 선언 위치. 줄 수는 생성 시점(2026-10-01, 주문내역 훈수 추가 후) 기준이라 조금 어긋날 수 있으니 `grep -n 이름 파일`로 재확인한다.

## 읽기·검색 제외 (큰 데이터, `.ignore`로 검색에서 뺌)
| 파일 | 크기 | 안전한 조회법 |
|---|---|---|
| `data/brands/brand-master.csv` | 3,555행, 787KB | 열 이름 `head -1`, 한 브랜드 `grep -n "^브랜드명," `; 분포는 python/awk 스크립트로 |
| `data/brands/brand-master.xlsx` | 바이너리 | csv와 동일 내용, 열지 말 것 |
| `src/server/roast/brands.json` | 1.1MB | csv에서 `scripts/build-brands.mjs`로 생성됨. 직접 읽지 말고 csv 기준으로 수정 후 재생성 |
| `supabase/migrations/…0010_color_names_korean.sql` | 1,948줄 | 색상 이름 일괄 변환용, 볼 일 없음 |
| `package-lock.json`, `src/lib/supabase/database.types.ts`(832줄, 생성) | | 필요한 테이블만 `grep -n -A20 "테이블명"` |
| `src/app/(app)/roast/fonts/*.woff2` | | 폰트, 무시 |

## 핵심 영역 길잡이
- **훈수(/roast)**: 화면 `src/components/roast/roast-view.tsx`(914), 서버 `src/server/roast/`. 점수 `score.ts`(`scoreWardrobe`)·점수 규칙값 `score-deltas.ts`·등급 `bands.ts`; 분석 `analyze.ts`; 대화 조립 `compose.ts`(`buildScript`, 결과 마무리 `composeResult`)·결과 본문 `report.ts`(`buildReport`)·문장 원문 `lines.ts`(대화 문장 say만)/`report-text.ts`; 질문 `questions.ts`(1295, `QUESTIONS`/`pickQuestions`), 퀴즈 `quiz.ts`(`QUIZ`); 질문 반응(1번·2번…)마다 붙이는 조건·조건별 결과 글 `react-when.ts`(`WHEN_DEFS`/`reactPool`, 저장 키 `questions.<질문>.when|result.<반응>`, 관리자 화면은 `roast-text-editor.tsx`의 `ReactField`·`WhenPicker`); 관리자 편집 단위·조건 `meta.ts`(`textGroups`)·`texts.ts`(저장된 문구 덮어쓰기 `DEFAULT_TEXTS`); 서버 액션 `actions.ts`(`startRoast`/`finishRoast`), 관리자 저장 `admin-actions.ts`. 훈수에는 AI 글쓰기가 없다(2026-10-01 제거; 옛 저장 결과 `headline`/`paragraphs`는 report 없는 결과를 열 때만 쓰임).
- **무신사 주문내역 훈수(/roast/orders, 메뉴 없음)**: 화면 `src/app/(app)/roast/orders/page.tsx` → `roast-view.tsx`(`orders` prop) + 붙여넣기·로딩 `src/components/roast/order-roast.tsx`(`OrderPaste`, 북마크 안내는 주문 가져오기와 같은 `garment-form/order-guide.tsx`의 `OrderGuide`, 사진은 `/api/imports/{id}/image` 프록시 주소). 서버 액션 `src/server/roast/order-actions.ts`(`startOrderRoast`/`finishOrderRoast`, 저장·AI 없음). 주문내역 전용 `src/server/roast/orders/`: 입력 `input.ts`(`toGarments`), 분석 `analysis.ts`(`analyzeOrders`), 수치 `metrics.ts`(랭킹템·스탠다드·반품), 점수 `score.ts`(`scoreOrders`)·기준값 `rules.ts`(`ORDER_RULES`/`ORDER_AGE_RULES`/`ORDER_DELTAS`), 질문 `questions.ts`(`ORDER_QUESTIONS`), 결과 문단 `report.ts`(`orderOverride` → `buildReport`의 override), 문장 `texts.ts`. 관리자 편집은 "주문내역 훈수" 탭(`meta.ts` textGroups의 kind "orders"). 주문내역에 실제로 나가는 옷장 훈수 문장(패턴 `orders.lines.*`·대화 공통 `orders.common.*`·공유 질문 quiz/food_vs_clothes/fashionable_q `orders.questions.*`·결과 문단 `orders.report.*`·화면 일부)은 전용 칸으로 복사돼 있다(`texts.ts`의 `ORDER_MIRROR`, 대상 목록 `orders/texts.ts`의 `ORDER_MIRROR_*`·`ORDER_SKIP_PATTERNS`). 전용 DB 값이 없으면 옷장 쪽 값을 따라가고(`applyTextEdits`), 있으면 전용 값이 우선, 주문내역 실행은 `forOrders(T)` 사본을 쓴다(`order-actions.ts` prepare). 퀴즈 항목(`quiz.*`)은 아직 옷장과 공유. 상품 하트·후기 수는 `parsers/musinsa.ts`(`popularityIn`), 주문 나누기는 `musinsa-orders.ts`(`parseOrdersForRoast`), 상품 읽기 API `/api/order-imports/item`(`roast: true`면 kind "roast"로 하루 분석 한도 대신 `ORDER_ROAST_DAILY_CAP`, 기록은 parser_version 끝 `ORDER_ROAST_SUFFIX`). 메뉴·노트 공개는 `src/lib/features.ts`의 `orderRoastMenu`.
- **관리자 점수/결과 구성 탭**: `src/components/admin/roast-text-editor.tsx`(`RoastTextEditor`), 페이지 `src/app/(app)/admin/roast-texts/`, 저장 `src/server/roast/admin-actions.ts`. 기본값 없음: 저장된 값(DB)이 기준이고 묶음(`GroupBlock`·`QuizForm`) 단위로 입력 1초 뒤·칸을 벗어날 때 자동 저장(`useAutosave`, 서버 `saveRoastUnits`/`saveRoastQuiz`). 코드 문장은 DB에 값이 없는 칸의 처음 값으로만 쓰임. 접었다 펴도 저장값이 보이도록 부모의 `saved`를 칸에 반영하고, 저장값이 코드 문장(`EditorUnit.base`)과 다르면 제목 옆 "고친 문장 (n/전체)"·칸 이름 옆 "(직접 수정함)"을 버건디색으로 표시.
- **브랜드 데이터**: csv → `scripts/build-brands.mjs` → `brands.json` → `src/server/roast/brands.ts`(`findBrand`, `normalizeBrand`, `BRAND_GROUPS`). 무신사 수집 스크립트 `scripts/musinsa/`.
- **핏 계산**: `src/lib/fit/compute.ts`(`computeFit`/`computeSize`), 내 치수 기반 `body-fit.ts`(`FIT_GROUPS`), 길이 `length-fit.ts`, 신발 `shoes.ts`, VS 비교 `versus.ts`, 비교 대상 선택 `select-comparables.ts`, 서버 `src/server/fit/service.ts`, AI 설명 `src/server/ai/fit-interpreter.ts`.
- **구매 판단기(핏체크)**: 화면 `src/components/fit-check/`(`fit-check-view`, `fit-result-view`, `versus-view`), API `src/app/api/fit-checks`, 링크 파싱 `src/server/import/`(`parsers/`, `registry.ts`, `service.ts`).
- **무신사 주문 가져오기**: `src/server/import/musinsa-orders.ts`, `src/lib/import/`, 화면 `src/components/garment-form/order-import-view.tsx`, 북마크 안내 `order-guide.tsx`(`OrderGuide`, 주문내역 훈수와 같이 씀). 훈수 결과 맨 아래 "분석한 제품 전부 옷장에 넣기"(`roast-view.tsx`)는 `/wardrobe/import-orders?from=roast`로 가며, 훈수가 읽은 결과를 `src/lib/import/order-handoff.ts`로 넘겨 재조회 없이 확인 화면을 연다(`order-import-view.tsx`의 `applyLookup`).
- **옷장/분석/코디**: `src/components/wardrobe/`, `src/server/garments/`, `src/components/analysis/wardrobe-analysis.ts`, `src/lib/outfit/recommend.ts`.
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
- `page.tsx` (40줄) metadata:10 RoastTextsPage:13

### src/app/(app)/analysis
- `page.tsx` (8줄) metadata:3 AnalysisPage:5

### src/app/(app)/body
- `page.tsx` (9줄) metadata:3 BodyPage:6

### src/app/(app)/fit-check
- `page.tsx` (8줄) metadata:3 FitCheckPage:5

### src/app/(app)/fit-check/[id]
- `page.tsx` (61줄) metadata:8 FitCheckResultPage:11

### src/app/(app)/outfit
- `page.tsx` (12줄) metadata:6 OutfitPage:8

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
- `roast-text-editor.tsx` EditorUnit EditorGroup WhenOption QuizValue EditorQuiz LayoutInfo RoastTextEditor useAutosave GroupBlock UnitField ReactField WhenPicker QuizForm
- `usd-rate-form.tsx` (45줄) UsdRateForm:9
- `user-actions.tsx` (71줄) UserActions:8

### src/components/analysis
- `analysis-view.tsx` (519줄) AnalysisView:34
- `wardrobe-analysis.ts` (359줄) CategoryTab:8 man:11 won:13 priceComment:56 halfYearAverage:76 recentSixMonths:86 priceSummary:95 monthlySummary:129 …

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
- `feature-showcase.tsx` (593줄) FeatureShowcase:37 — 첫 화면 대표 기능 탭(옷장 관리·구매 판단·옷장 훈수). 탭 글은 `FEATURES`:551, 예시 화면 WardrobeDemo:277·FitCheckDemo:400·RoastDemo:480. 움직임은 `landing.css`(--d 지연, 자동 넘김 막대 animationend로 다음 탭)
- `promo-banner.tsx` (120줄) PromoBanner — 로그인 화면 회원가입 줄 아래 새 기능 알림 배너(클릭 없음)(signin·signup 모드). 항목은 `PROMOS` 목록 한 곳에서 추가·수정, 2개 이상이면 5초마다 왼쪽 밀어내기 전환(`landing.css`의 pb-slide), 마우스·포커스 시 멈춤, 점으로 이동
- `service-intro.tsx` (34줄) ServiceIntro:9 — 로그인 화면 왼쪽(제목·소개 한 줄 + FeatureShowcase)

### src/components/layout
- `app-header.tsx` (70줄) AppHeader:21
- `release-notes-dialog.tsx` (445줄) ReleaseNotesDialog:30
- `theme-toggle.tsx` (104줄) ThemeToggle:52
- `user-menu.tsx` (107줄) UserMenu:11

### src/components/legal
- `legal-page.tsx` (41줄) LegalPage:5 LegalSection:23 LegalList:32
- `site-footer.tsx` (21줄) SiteFooter:8

### src/components/outfit
- `outfit-view.tsx` (139줄) OutfitView:20

### src/components/roast
- `order-roast.tsx` (198줄) OrderCopy:21 OrderPaste:45
- `roast-view.tsx` (914줄) RoastView:65

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
- `garment-thumbnail.tsx` (40줄) GarmentThumbnail:11
- `wardrobe-filters.tsx` (181줄) WardrobeFilters:13
- `wardrobe-store.tsx` (410줄) GarmentDraft:29 PendingDraft:30 ImageChange:33 SaveResult:36 NETWORK_ERROR:117 WardrobeProvider:137 useOpenGarmentId:381 useWardrobe:385 …
- `wardrobe-table.tsx` (309줄) WardrobeViewMode:17 GarmentSelection:19 WardrobeTable:33
- `wardrobe-view.tsx` (431줄) WardrobeView:36

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

### src/lib/outfit
- `recommend.ts` (343줄) WearSeason:13 OUTFIT_ORDER:16 OutfitItem:19 OutfitResult:24 seasonOfDate:29 localDateKey:38 fitsSeason:55 recommendOutfit:285

### src/lib/roast
- `bubbles.ts` (31줄) splitSentences:7 joinBubbles:10 bubblesOf:13 isBubbleKey:20
- `copy.ts` (33줄) ROAST_COPY:5 RoastCopy:28 DISCLAIMER:30 MIN_CLOTHES:31 tooFew:32
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
- `actions.ts` (178줄) startRoast:77 finishRoast:96
- `admin-actions.ts` (~115줄) RoastTextResult:14 saveRoastUnits deleteRoastQuiz saveRoastQuiz
- `analyze.ts` (678줄) ACHROMATIC:20 MIN_GARMENTS:21 FIT_WORD:24 Item:34 brandKindOf:70 colorCounted:80 Stat:82 Pattern:84 …
- `bands.ts` (104줄) Band:11 BANDS:23 bandOf:80 findBand:92
- `brands.ts` (191줄) BrandInfo:9 BRANDS:46 MUSINSA_POPULAR:48 musinsaLikesCut:54 BrandGroup:59 BRAND_GROUPS:72 GROUP_WORD:87 normalizeBrand:102 isTrueHeritage:187(진짜 헤리티지 판정) …
- `compose.ts` (289줄) varsOf:29 arrangeBlocks:107(질문 섹션 EXTRA_QUESTION_SECTION, 주문내역 질문 포함) Plan:129 quotesAnswer:137 buildScript:145 asOrders:262 Composed:275 composeResult:283(마무리 문장·뚜렷한 패턴만, 결과 본문은 report.ts)
- `keywords.ts` (50줄) FAMILIES:4 FamilyId:33 FAMILY_IDS:34 familyName:35 productFamilies:40
- `lines.ts` (357줄) Section:13 PatternLines:28 COMMON:34 LINE_SECTION:98 LINE_TEXT:162
- `meta.ts` (549줄) VAR_LABEL:15 SECTION_NAME:24 PATTERN_COND:28 QUESTION_COND:92 REACT_NAME:145 SCREEN_NAME:152 COMMON_NAME:171 varLabel:187 textGroups(주문내역 전용 칸 묶음 포함) fieldLabel …
- `order-actions.ts` (162줄) beginOrderRoast:60 orderRoastUsed:78 startOrderRoast:86 finishOrderRoast:102 (하루 1회: 붙여넣기 직후 beginOrderRoast가 roast_runs kind='orders'에 기록, 관리자·테스터 예외, 상품 읽기 API도 기록 없으면 403)
- `order-limit.ts` (31줄) kstDayStart:14 orderRoastUsedToday:19 (한국 시간 0시 기준 하루 1회)
- `react-when.ts` (~75줄) WhenDef WHEN_DEFS checkWhen whenMatches reactPool (반응별 조건)
- `queries.ts` (57줄) getLatestRoast:12 signGarments:27 getRoastTextEdits:43 getRoastTexts:54
- `questions.ts` (1295줄) QuestionDef:19 QuestionText:34 chimchakItems:69(침착맨 질문 조건) fromShop:78 QUESTIONS:80 Q_TEXT:243 AskedQuestion:1063 brandTrio:1085 …
- `quiz.ts` (680줄) QuizEntry:14 QUIZ:24 PickedQuiz:668 pickQuiz:673
- `report-text.ts` (246줄) REPORT_TEXT:10 ReportTexts:246
- `report.ts` (603줄) ReportOverride:89 buildReport:102 limitPhotos:568 splitLead:589 tryFill:594
- `score-deltas.ts` (249줄) SCORE_DELTAS:9 SCORE_RULES:88 ScoreRules:184 AGE_RULES:191 AGE_BANDS:238
- `score.ts` (385줄) ScorePart:16 WardrobeScore:25 ScoreOptions:33 isTopDesigner:44 isMidTier:46 isHeritage:48 isGood:50 isNice:52 isFormalLux:55 isRepro:56 monthIndex:59(판정 함수는 주문내역 점수도 씀) scoreWardrobe:64 fitContrast:302 ageAt:307 bandName:314 bandOf:322 …
- `shift.ts` (64줄) ShiftRules:3 TasteShift:9 detectTasteShift:40
- `text.ts` (119줄) josa:56 won:66 Vars:75 MissingVar:78 fill:80 varsOf:91 rng:94 Rng:118
- `texts.ts` (266줄) DEFAULT_TEXTS:40 RoastTexts:50 ROAST_TEXT_MAX:52 CUSTOM_QUIZ_ID:55 UnitKind:57 UnitValue:58 TextUnit:60 unitsOf:69 orderMirrorKeys forOrders(주문내역 전용 칸 덮기) …

### src/server/roast/orders
- `analysis.ts` (18줄) analyzeOrders:12(마지막 인자 body: 내 치수를 입력한 사람만 넣음, order-actions prepare가 getMyBodyProfile로 불러 줌)
- `context.ts` (38줄) OrderPop:7 OrderEvent:14 OrderContext:23(orderOf·measure: 같은 옷 반복용)
- `input.ts` (86줄) orderItemSchema:16 OrderRoastItem:35 orderListSchema:36 measurementsOf(실측 문자열→옷 실측, 내 치수 비교용) toGarments:51
- `metrics.ts` (106줄) orderRules:8 isStandard:10 likesOf:13 reviewsOf:14 isRanking:17 isHidden:27 thirds:35 busiestMonth:50 … styleShiftOf(오래된·최근 1/3 주 스타일, 질문·결과 글 공용)
- `questions.ts` (92줄) ORDER_QUESTIONS:33
- `report.ts` (105줄) orderOverride:29
- `rules.ts` (176줄) ORDER_RULES:6 OrderRules:142 ORDER_AGE_RULES:149 ORDER_DELTAS:162
- `score.ts` (286줄) OrderAgeKind:18 OrderScore:19 scoreOrders:42 orderTier:283 (점수 계산표 /mnt/project-files/roast/order-score-table.md; 새 감점: tiny 극단적 저가·size_mess 사이즈 갈팡질팡·body_off 내 치수에 안 맞는 옷)
- `texts.ts` (529줄) ORDER_SKIP_PATTERNS ORDER_MIRROR_SCREEN/QUESTIONS/REPORT_SKIP ORDER_SCREEN:9 ORDER_COMMON:41 ORDER_Q_TEXT:49 ORDER_REPORT_TEXT:248 ORDER_QUESTION_COND:300 ORDER_PART_NAME:317 ORDER_RULE_NAME:368 ORDER_AGE_KEY_NAME:480 …

### src/server/security
- `url-guard.ts` (89줄) isBlockedIp:56 ALLOWED_PORTS:67 UrlCheck:69 checkUrlShape:72

### src/server/settings
- `queries.ts` (20줄) getUsdRate:9
