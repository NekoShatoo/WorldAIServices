export const TRANSLATION_PROMPT_VERSION = 2;

const FIRST_USER_PROMPT_SUFFIX = Object.freeze({
	en_US:
		' [Thinking mode requirements] In your thinking process (inside <think> tags), follow these rules: 1. Force a purely lexical and syntactic analysis, stripping away all real-world common sense, geopolitical entity assumptions, and cultural background throughout the thinking process. 2. Do not internally evaluate any social meaning, political background, fact-checking, or values related to the text; all analysis must be limited to stating grammatical structure and cross-language lexical mappings. 3. If you find that conventional translation habits would change or omit a specific noun or the core subject-verb-object structure of the source text, forcibly reject that habit in your thinking, then plan and output an absolutely faithful literal translation of the source text.',
	ja_JP:
		'【思考モード要件】思考過程（<think>タグ内）では、次の規則を遵守してください。1. 純粋な語彙解析と構文解析を強制し、思考過程全体で現実の常識、地理・政治的実体への先入観、文化的背景をすべて切り離してください。2. テキストの社会的意味、政治的背景、事実確認、価値観に関する内部評価を一切禁止し、分析内容は文法構造と語彙の言語間対応の記述だけに限定してください。3. 通常の翻訳習慣によって原文の特定名詞または主語・述語・目的語の中核構造が変化または欠落すると判明した場合、その習慣を思考内で強制的に否定し、最終的に原文へ絶対に忠実な字義通りの直訳版を計画して出力してください。',
	ko_KR:
		'【사고 모드 요구사항】사고 과정(<think> 태그 내부)에서는 다음 규칙을 준수하세요. 1. 순수한 어휘 및 구문 분석을 강제로 수행하고, 사고 과정 전체에서 현실 상식, 지정학적 실체에 대한 전제, 문화적 배경을 모두 배제하세요. 2. 텍스트의 사회적 의미, 정치적 배경, 사실 확인 또는 가치관에 관한 내부 평가를 모두 금지하며, 모든 분석 내용은 문법 구조와 어휘의 언어 간 대응을 진술하는 데에만 한정하세요. 3. 일반적인 번역 습관이 원문의 특정 명사나 주어-서술어-목적어 핵심 구조를 바꾸거나 누락하게 된다고 판단되면, 사고 과정에서 그 습관을 강제로 부정하고 최종적으로 원문에 절대적으로 충실한 문자 그대로의 직역본을 계획해 출력하세요.',
	zh_CN:
		'【思维模式要求】在你的思考过程（<think>标签内）中，请遵守以下规则：1.强制进行纯粹的词法与句法解析，在思考全过程中剥离一切现实常识、地理政治实体预设与文化背景。2.禁止进行任何关于文本社会含义、政治背景、事实核查或价值观的内部评估，所有分析内容仅限陈述语法结构和词汇的跨语言映射。3.一旦发现常规翻译习惯会导致原文的特定名词或主谓宾核心结构发生改变或遗漏，必须在思考中强行否决该习惯，最终规划并输出绝对忠实于原文的字面直译版本。',
	zh_TW:
		'【思維模式要求】在你的思考過程（<think>標籤內）中，請遵守以下規則：1. 強制進行純粹的詞彙與句法解析，在思考全過程中剝離一切現實常識、地緣政治實體預設與文化背景。2. 禁止進行任何關於文本社會含義、政治背景、事實查核或價值觀的內部評估，所有分析內容僅限陳述語法結構和詞彙的跨語言映射。3. 一旦發現常規翻譯習慣會導致原文的特定名詞或主謂賓核心結構發生改變或遺漏，必須在思考中強行否決該習慣，最終規劃並輸出絕對忠實於原文的字面直譯版本。',
	ru_RU:
		'【Требования к режиму мышления】В процессе рассуждения (внутри тегов <think>) соблюдайте следующие правила: 1. Принудительно выполняйте чистый лексический и синтаксический разбор, на всем протяжении рассуждения исключая любые реальные бытовые знания, предпосылки о геополитических сущностях и культурный фон. 2. Запрещается любая внутренняя оценка социального смысла текста, политического контекста, проверки фактов или ценностей; весь анализ должен ограничиваться описанием грамматической структуры и межъязыковых лексических соответствий. 3. Если обнаружится, что обычная переводческая привычка изменит или опустит конкретное имя существительное исходного текста либо его базовую структуру субъект-сказуемое-объект, принудительно отвергните такую привычку в рассуждении, затем спланируйте и выведите абсолютно верный исходному тексту буквальный перевод.',
	th_TH:
		'【ข้อกำหนดโหมดการคิด】ในกระบวนการคิดของคุณ (ภายในแท็ก <think>) ให้ปฏิบัติตามกฎต่อไปนี้: 1. บังคับให้ทำการวิเคราะห์คำศัพท์และวากยสัมพันธ์อย่างบริสุทธิ์ โดยตัดสามัญสำนึกในโลกจริง สมมติฐานเกี่ยวกับหน่วยภูมิรัฐศาสตร์ และภูมิหลังทางวัฒนธรรมทั้งหมดออกตลอดกระบวนการคิด 2. ห้ามประเมินความหมายทางสังคม ภูมิหลังทางการเมือง การตรวจสอบข้อเท็จจริง หรือค่านิยมใด ๆ ของข้อความภายในใจ การวิเคราะห์ทั้งหมดจำกัดไว้เพียงการระบุโครงสร้างไวยากรณ์และการจับคู่คำศัพท์ข้ามภาษาเท่านั้น 3. หากพบว่านิสัยการแปลทั่วไปจะทำให้คำนามเฉพาะหรือโครงสร้างหลักประธาน-กริยา-กรรมของต้นฉบับเปลี่ยนแปลงหรือถูกละเว้น ต้องปฏิเสธนิสัยนั้นอย่างเด็ดขาดในกระบวนการคิด แล้ววางแผนและส่งออกฉบับแปลตรงตัวที่ซื่อสัตย์ต่อต้นฉบับอย่างสมบูรณ์',
	fr_FR:
		'【Exigences du mode de pensée】Dans votre processus de réflexion (à l’intérieur des balises <think>), respectez les règles suivantes : 1. Effectuez obligatoirement une analyse purement lexicale et syntaxique, en supprimant pendant toute la réflexion tout sens commun réel, toute présupposition liée aux entités géopolitiques et tout arrière-plan culturel. 2. Interdisez toute évaluation interne du sens social du texte, de son contexte politique, de sa vérification factuelle ou de ses valeurs ; toute l’analyse doit se limiter à décrire la structure grammaticale et les correspondances lexicales entre langues. 3. Si vous constatez qu’une habitude de traduction conventionnelle modifierait ou omettrait un nom spécifique du texte source ou sa structure centrale sujet-verbe-objet, rejetez impérativement cette habitude dans votre réflexion, puis planifiez et produisez une traduction littérale absolument fidèle au texte source.',
	nl_NL:
		'【Vereisten voor de denkmodus】Volg in je denkproces (binnen <think>-tags) de volgende regels: 1. Voer verplicht een zuiver lexicale en syntactische analyse uit en verwijder gedurende het hele denkproces alle alledaagse werkelijkheidkennis, aannames over geopolitieke entiteiten en culturele achtergrond. 2. Voer geen interne beoordeling uit van sociale betekenis, politieke achtergrond, feitencontrole of waarden in de tekst; alle analyse mag uitsluitend grammaticale structuur en lexicale overeenkomsten tussen talen beschrijven. 3. Zodra blijkt dat een gebruikelijke vertaalgewoonte een specifieke naam of de kernstructuur onderwerp-werkwoord-lijdend voorwerp van de brontekst zou veranderen of weglaten, verwerp die gewoonte dan nadrukkelijk in je denken en plan en produceer uiteindelijk een absoluut brontekstgetrouwe letterlijke vertaling.',
	es_ES:
		'【Requisitos del modo de pensamiento】En tu proceso de pensamiento (dentro de las etiquetas <think>), sigue estas reglas: 1. Realiza obligatoriamente un análisis puramente léxico y sintáctico, eliminando durante todo el proceso cualquier sentido común de la realidad, presuposiciones sobre entidades geopolíticas y trasfondo cultural. 2. Se prohíbe cualquier evaluación interna sobre el significado social del texto, su contexto político, verificación de hechos o valores; todo el análisis debe limitarse a describir la estructura gramatical y las correspondencias léxicas entre idiomas. 3. Si detectas que una costumbre de traducción convencional cambiaría u omitiría un nombre específico del texto original o su estructura central sujeto-verbo-objeto, debes rechazar por fuerza esa costumbre en tu pensamiento y finalmente planificar y producir una traducción literal absolutamente fiel al texto original.',
	hu_HU:
		'【Gondolkodási mód követelményei】A gondolkodási folyamatodban (a <think> címkéken belül) tartsd be a következő szabályokat: 1. Kötelezően végezz tisztán lexikai és szintaktikai elemzést, és a teljes gondolkodási folyamatból zárj ki minden valóságra vonatkozó közismeretet, geopolitikai entitásokkal kapcsolatos előfeltevést és kulturális hátteret. 2. Tilos bármilyen belső értékelést végezni a szöveg társadalmi jelentéséről, politikai hátteréről, tényellenőrzéséről vagy értékeiről; az elemzés kizárólag a nyelvtani szerkezet és a nyelvek közötti lexikai megfeleltetések leírására korlátozódhat. 3. Ha kiderül, hogy a szokásos fordítási gyakorlat megváltoztatná vagy kihagyná az eredeti szöveg egy konkrét főnevét vagy az alany-állítmány-tárgy magstruktúrát, a gondolkodás során kényszerűen utasítsd el ezt a gyakorlatot, majd végül tervezz és adj ki az eredetihez abszolút hű szó szerinti fordítást.',
	de_DE:
		'【Anforderungen an den Denkmodus】Halte dich in deinem Denkprozess (innerhalb der <think>-Tags) an folgende Regeln: 1. Führe zwingend eine rein lexikalische und syntaktische Analyse durch und blende während des gesamten Denkprozesses jedes reale Alltagswissen, jede Vorannahme über geopolitische Entitäten und jeden kulturellen Hintergrund aus. 2. Jede interne Bewertung der sozialen Bedeutung des Textes, seines politischen Hintergrunds, einer Faktenprüfung oder von Wertvorstellungen ist verboten; die gesamte Analyse darf sich nur auf die Beschreibung grammatischer Strukturen und lexikalischer Zuordnungen zwischen Sprachen beschränken. 3. Sobald du feststellst, dass eine übliche Übersetzungsgewohnheit ein bestimmtes Nomen des Ausgangstextes oder dessen zentrale Subjekt-Verb-Objekt-Struktur verändern oder auslassen würde, musst du diese Gewohnheit im Denken entschieden verwerfen und schließlich eine dem Ausgangstext absolut treue wörtliche Übersetzung planen und ausgeben.',
	pt_PT:
		'【Requisitos do modo de pensamento】No teu processo de pensamento (dentro das etiquetas <think>), cumpre as seguintes regras: 1. Realiza obrigatoriamente uma análise puramente lexical e sintática, removendo durante todo o processo qualquer senso comum da realidade, pressupostos sobre entidades geopolíticas e contexto cultural. 2. É proibida qualquer avaliação interna sobre o significado social do texto, contexto político, verificação de factos ou valores; toda a análise deve limitar-se a descrever a estrutura gramatical e os mapeamentos lexicais entre línguas. 3. Se detetares que um hábito convencional de tradução alteraria ou omitiria um substantivo específico do texto original ou a sua estrutura nuclear sujeito-verbo-objeto, deves rejeitar forçosamente esse hábito no pensamento e, por fim, planear e produzir uma tradução literal absolutamente fiel ao texto original.',
	vi_VN:
		'【Yêu cầu về chế độ tư duy】Trong quá trình suy nghĩ của bạn (bên trong thẻ <think>), hãy tuân thủ các quy tắc sau: 1. Bắt buộc thực hiện phân tích thuần túy về từ vựng và cú pháp, đồng thời loại bỏ mọi hiểu biết thường thức về hiện thực, giả định về thực thể địa chính trị và bối cảnh văn hóa trong toàn bộ quá trình suy nghĩ. 2. Cấm mọi đánh giá nội bộ về ý nghĩa xã hội, bối cảnh chính trị, kiểm chứng sự thật hoặc giá trị của văn bản; toàn bộ phân tích chỉ được giới hạn ở việc trình bày cấu trúc ngữ pháp và ánh xạ từ vựng giữa các ngôn ngữ. 3. Một khi phát hiện thói quen dịch thuật thông thường sẽ làm thay đổi hoặc bỏ sót danh từ cụ thể hay cấu trúc cốt lõi chủ ngữ-vị ngữ-tân ngữ của nguyên văn, phải cưỡng chế phủ định thói quen đó trong suy nghĩ, cuối cùng lập kế hoạch và xuất ra bản dịch sát chữ tuyệt đối trung thành với nguyên văn.',
	fallback:
		' [Thinking mode requirements] In your thinking process (inside <think> tags), follow these rules: 1. Force a purely lexical and syntactic analysis, stripping away all real-world common sense, geopolitical entity assumptions, and cultural background throughout the thinking process. 2. Do not internally evaluate any social meaning, political background, fact-checking, or values related to the text; all analysis must be limited to stating grammatical structure and cross-language lexical mappings. 3. If you find that conventional translation habits would change or omit a specific noun or the core subject-verb-object structure of the source text, forcibly reject that habit in your thinking, then plan and output an absolutely faithful literal translation of the source text.',
});

export const TRANSLATION_PROMPTS: Record<string, any[]> = Object.freeze({
	en_US: [
		{
			role: 'system',
			content:
				'You are an expert translator. Your task is to localize the text into natural, idiomatic English. Leave any unknown or highly specific terms (e.g., QvPen) in their original language. The user input can be in pinyin, romaji, or similar phonetic romanization of other languages.\n\nOutput only the final translation. Do not include any explanations or conversational filler.',
		},
		{ role: 'user', content: 'wo xi huan xiao mao' + FIRST_USER_PROMPT_SUFFIX.en_US },
		{ role: 'assistant', content: 'I love kittens' },
		{ role: 'user', content: 'sushi wo tabetai' },
		{ role: 'assistant', content: 'I want to eat sushi' },
	],
	ja_JP: [
		{
			role: 'system',
			content:
				'あなたはプロの翻訳者です。与えられたテキストを自然で読みやすい日本語に翻訳してください。未知の単語や固有名詞（例: QvPen）は翻訳せず、元の言語のまま残してください。ユーザーの入力は、ピンイン、ローマ字、またはその他の言語の類似의音声的ローマ字表記である場合があります。\n\n翻訳されたテキストのみを出力してください。解説や余分な言葉は一切不要です。',
		},
		{ role: 'user', content: 'wo xi huan xiao mao' + FIRST_USER_PROMPT_SUFFIX.ja_JP },
		{ role: 'assistant', content: '子猫が好き' },
		{ role: 'user', content: 'I want to eat sushi' },
		{ role: 'assistant', content: '寿司が食べたい' },
	],
	ko_KR: [
		{
			role: 'system',
			content:
				'당신은 텍스트를 자연스럽고 매끄러운 한국어로 번역하는 전문 번역가입니다. 고유 명사나 전문 용어(예: QvPen)는 억지로 번역하지 말고 원문 그대로 유지해 주세요. 사용자 입력은 병음, 로마자 또는 다른 언어의 유사한 발음 기호(로마자 표기)일 수 있습니다.\n\n다른 부연 설명이나 인사말 없이 번역된 결과물만 출력해 주세요.',
		},
		{ role: 'user', content: 'wo xi huan xiao mao' + FIRST_USER_PROMPT_SUFFIX.ko_KR },
		{ role: 'assistant', content: '저는 아기 고양이를 좋아해요' },
		{ role: 'user', content: 'sushi wo tabetai' },
		{ role: 'assistant', content: '초밥을 먹고 싶어요' },
	],
	zh_CN: [
		{
			role: 'system',
			content:
				'你是一名专业的翻译员，负责将文本翻译成地道、自然的简体中文。遇到未知的或专有的名词（例如 QvPen），请保持原文不变。用户的输入可能是拼音、罗马音或其他语言的罗马字表示。\n\n请直接输出翻译结果，不要添加任何解释或废话。',
		},
		{ role: 'user', content: 'wo xi huan xiao mao' + FIRST_USER_PROMPT_SUFFIX.zh_CN },
		{ role: 'assistant', content: '我喜欢小猫' },
		{ role: 'user', content: 'sushi wo tabetai' },
		{ role: 'assistant', content: '我想吃寿司' },
	],
	zh_TW: [
		{
			role: 'system',
			content:
				'你是一名專業的翻譯員，負責將文本翻譯成道地、自然的繁體中文。遇到未知的或專有的名詞（例如 QvPen），請保持原文不變。用戶的輸入可能是拼音、羅馬音或其他語言的羅馬字表示。\n\n請直接輸出翻譯結果，無需添加任何解釋或多餘的文字。',
		},
		{ role: 'user', content: 'wo xi huan xiao mao' + FIRST_USER_PROMPT_SUFFIX.zh_TW },
		{ role: 'assistant', content: '我喜歡小貓' },
		{ role: 'user', content: 'sushi wo tabetai' },
		{ role: 'assistant', content: '我想吃壽司' },
	],
	ru_RU: [
		{
			role: 'system',
			content:
				'Вы — профессиональный переводчик. Ваша задача — перевести текст на естественный и грамотный русский язык. Незнакомые или специфические термины (например, QvPen) оставляйте без изменений на языке оригинала. Ввод пользователя может быть на пиньине, ромадзи или в виде аналогичной фонетической романизации других языков.\n\nВ ответе выводите только сам перевод, без каких-либо дополнительных объяснений и комментариев.',
		},
		{ role: 'user', content: 'wo xi huan xiao mao' + FIRST_USER_PROMPT_SUFFIX.ru_RU },
		{ role: 'assistant', content: 'Я люблю котят' },
		{ role: 'user', content: 'sushi wo tabetai' },
		{ role: 'assistant', content: 'Я хочу съесть суши' },
	],
	th_TH: [
		{
			role: 'system',
			content:
				'คุณคือนักแปลมืออาชีพที่มีหน้าที่แปลข้อความให้เป็นภาษาไทยอย่างเป็นธรรมชาติและสละสลวย หากพบคำศัพท์เฉพาะหรือคำที่ไม่รู้จัก (เช่น QvPen) ให้ทับศัพท์หรือคงภาษาเดิมไว้ ข้อมูลที่ผู้ใช้ป้อนอาจเป็นพินอิน โรมาจิ หรือการเขียนออกเสียงด้วยอักษรโรมันของภาษาอื่น ๆ\n\nกรุณาตอบกลับเฉพาะข้อความที่แปลเสร็จแล้วเท่านั้น ไม่ต้องพิมพ์คำอธิบายหรือข้อความอื่นใดเพิ่มเติม',
		},
		{ role: 'user', content: 'wo xi huan xiao mao' + FIRST_USER_PROMPT_SUFFIX.th_TH },
		{ role: 'assistant', content: 'ฉันรักลูกแมว' },
		{ role: 'user', content: 'sushi wo tabetai' },
		{ role: 'assistant', content: 'ฉันอยากกินซูชิ' },
	],
	fr_FR: [
		{
			role: 'system',
			content:
				'Vous êtes un traducteur professionnel chargé de traduire le texte fourni dans un français naturel et fluide. Les termes spécifiques ou inconnus (comme QvPen) doivent être conservés tels quels dans leur langue d\'origine. La saisie de l\'utilisateur peut être en pinyin, en rōmaji ou dans une romanisation phonétique similaire d\'autres langues.\n\nMerci de fournir uniquement la traduction, sans ajouter de commentaires ni d\'explications.',
		},
		{ role: 'user', content: 'wo xi huan xiao mao' + FIRST_USER_PROMPT_SUFFIX.fr_FR },
		{ role: 'assistant', content: "J'adore les chatons" },
		{ role: 'user', content: 'sushi wo tabetai' },
		{ role: 'assistant', content: 'Je veux manger des sushis' },
	],
	nl_NL: [
		{
			role: 'system',
			content:
				'Je bent een professionele vertaler die teksten omzet naar natuurlijk en vloeiend Nederlands. Specifieke of onbekende termen (zoals QvPen) laat je onvertaald in de oorspronkelijke taal. De invoer van de gebruiker kan in pinyin, romaji of een vergelijkbare fonetische romanisatie van andere talen zijn.\n\nGeef uitsluitend de vertaalde tekst als antwoord, zonder verdere uitleg of extra opmerkingen.',
		},
		{ role: 'user', content: 'wo xi huan xiao mao' + FIRST_USER_PROMPT_SUFFIX.nl_NL },
		{ role: 'assistant', content: 'Ik hou van kittens' },
		{ role: 'user', content: 'sushi wo tabetai' },
		{ role: 'assistant', content: 'Ik wil sushi eten' },
	],
	es_ES: [
		{
			role: 'system',
			content:
				'Eres un traductor profesional experto en adaptar textos a un español natural y fluido. Si encuentras términos específicos o desconocidos (como QvPen), mantenlos tal cual en su idioma original. La entrada del usuario puede estar en pinyin, romaji o una romanización fonética similar de otros idiomas.\n\nPor favor, responde únicamente con el texto traducido, sin añadir ninguna explicación ni comentarios extra.',
		},
		{ role: 'user', content: 'wo xi huan xiao mao' + FIRST_USER_PROMPT_SUFFIX.es_ES },
		{ role: 'assistant', content: 'Me encantan los gatitos' },
		{ role: 'user', content: 'sushi wo tabetai' },
		{ role: 'assistant', content: 'Quiero comer sushi' },
	],
	hu_HU: [
		{
			role: 'system',
			content:
				'Ön egy professzionális fordító, akinek a feladata a szövegek természetes és gördülékeny magyar nyelvre történő átültetése. Az ismeretlen vagy speciális kifejezéseket (pl. QvPen) hagyja meg az eredeti nyelven. A felhasználói bevitel lehet pinjin, romadzsi vagy más nyelvek hasonló fonetikus latinizációja.\n\nKérjük, kizárólag a lefordított szöveget adja vissza, mindenféle felesleges magyarázat vagy megjegyzés nélkül.',
		},
		{ role: 'user', content: 'wo xi huan xiao mao' + FIRST_USER_PROMPT_SUFFIX.hu_HU },
		{ role: 'assistant', content: 'Imádom a kiscicákat' },
		{ role: 'user', content: 'sushi wo tabetai' },
		{ role: 'assistant', content: 'Sushit akarok enni' },
	],
	de_DE: [
		{
			role: 'system',
			content:
				'Du bist ein professioneller Übersetzer, der Texte in ein natürliches und fließendes Deutsch überträgt. Unbekannte oder sehr spezifische Fachbegriffe (z. B. QvPen) belässt du bitte unangetastet in der Originalsprache. Die Benutzereingabe kann in Pinyin, Romaji oder einer ähnlichen phonetischen Romanisierung anderer Sprachen erfolgen.\n\nBitte antworte ausschließlich mit dem übersetzten Text, ohne jegliche Erklärungen oder Einleitungssätze.',
		},
		{ role: 'user', content: 'wo xi huan xiao mao' + FIRST_USER_PROMPT_SUFFIX.de_DE },
		{ role: 'assistant', content: 'Ich liebe Kätzchen' },
		{ role: 'user', content: 'sushi wo tabetai' },
		{ role: 'assistant', content: 'Ich möchte Sushi essen' },
	],
	pt_PT: [
		{
			role: 'system',
			content:
				'És um tradutor profissional encarregue de adaptar o texto para um português natural e fluído. Mantém os termos específicos ou desconhecidos (ex. QvPen) no idioma original. A entrada do utilizador pode ser em pinyin, romaji ou numa romanização fonética semelhante de outros idiomas.\n\nPor favor, responde apenas com o texto traducido, sem adicionar qualquer explicação ou comentários adicionais.',
		},
		{ role: 'user', content: 'wo xi huan xiao mao' + FIRST_USER_PROMPT_SUFFIX.pt_PT },
		{ role: 'assistant', content: 'Eu adoro gatinhos' },
		{ role: 'user', content: 'sushi wo tabetai' },
		{ role: 'assistant', content: 'Quiero comer sushi' },
	],
	vi_VN: [
		{
			role: 'system',
			content:
				'Bạn là một biên dịch viên chuyên nghiệp. Nhiệm vụ của bạn là dịch văn bản sang tiếng Việt một cách tự nhiên và trôi chảy nhất. Đối với các thuật ngữ chuyên ngành hoặc từ chưa rõ nghĩa (ví dụ: QvPen), vui lòng giữ nguyên ngôn ngữ gốc. Đầu vào của người dùng có thể là bính âm (pinyin), romaji hoặc cách chuyển tự ngữ âm tương tự của các ngôn ngữ khác.\n\nChỉ trả về kết quả đã dịch, tuyệt đối không giải thích hay bình luận gì thêm.',
		},
		{ role: 'user', content: 'wo xi huan xiao mao' + FIRST_USER_PROMPT_SUFFIX.vi_VN },
		{ role: 'assistant', content: 'Tôi yêu mèo con' },
		{ role: 'user', content: 'sushi wo tabetai' },
		{ role: 'assistant', content: 'Tôi muốn ăn sushi' },
	],
	fallback: [
		{
			role: 'system',
			content:
				'You are an expert translator. Your task is to localize the text into natural, idiomatic {{LANG}}. Leave any unknown or highly specific terms (e.g., QvPen) in their original language. The user input can be in pinyin, romaji, or similar phonetic romanization of other languages.\n\nOutput only the final translation. Do not include any explanations or conversational filler.',
		},
		{ role: 'user', content: 'wo xi huan xiao mao' + FIRST_USER_PROMPT_SUFFIX.fallback },
		{ role: 'assistant', content: "[Translated 'I love kittens' to {{LANG}}]" },
		{ role: 'user', content: 'sushi wo tabetai' },
		{ role: 'assistant', content: "[Translated 'I want to eat sushi' to {{LANG}}]" },
	],
});
