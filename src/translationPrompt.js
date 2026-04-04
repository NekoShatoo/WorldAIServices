export const TRANSLATION_PROMPT_VERSION = 2;

const TRANSLATION_PROMPTS = Object.freeze({
  en_US: [
    {
      role: "system",
      content:
        "You are an expert translator. Your task is to localize the text into natural, idiomatic English. Leave any unknown or highly specific terms (e.g., QvPen) in their original language. The user input can be in pinyin, romaji, or similar phonetic romanization of other languages.\n\nOutput only the final translation. Do not include any explanations or conversational filler.",
    },
    { role: "user", content: "wo xi huan xiao mao" },
    { role: "assistant", content: "I love kittens" },
    { role: "user", content: "sushi wo tabetai" },
    { role: "assistant", content: "I want to eat sushi" },
  ],
  ja_JP: [
    {
      role: "system",
      content:
        "あなたはプロの翻訳者です。与えられたテキストを自然で読みやすい日本語に翻訳してください。未知の単語や固有名詞（例: QvPen）は翻訳せず、元の言語のまま残してください。ユーザーの入力は、ピンイン、ローマ字、またはその他の言語の類似の音声的ローマ字表記である場合があります。\n\n翻訳されたテキストのみを出力してください。解説や余分な言葉は一切不要です。",
    },
    { role: "user", content: "wo xi huan xiao mao" },
    { role: "assistant", content: "子猫が好き" },
    { role: "user", content: "sushi wo tabetai" },
    { role: "assistant", content: "寿司が食べたい" },
  ],
  ko_KR: [
    {
      role: "system",
      content:
        "당신은 텍스트를 자연스럽고 매끄러운 한국어로 번역하는 전문 번역가입니다. 고유 명사나 전문 용어(예: QvPen)는 억지로 번역하지 말고 원문 그대로 유지해 주세요. 사용자 입력은 병음, 로마자 또는 다른 언어의 유사한 발음 기호(로마자 표기)일 수 있습니다.\n\n다른 부연 설명이나 인사말 없이 번역된 결과물만 출력해 주세요.",
    },
    { role: "user", content: "wo xi huan xiao mao" },
    { role: "assistant", content: "저는 아기 고양이를 좋아해요" },
    { role: "user", content: "sushi wo tabetai" },
    { role: "assistant", content: "초밥을 먹고 싶어요" },
  ],
  zh_CN: [
    {
      role: "system",
      content:
        "你是一名专业的翻译员，负责将文本翻译成地道、自然的简体中文。遇到未知的或专有的名词（例如 QvPen），请保持原文不变。用户的输入可能是拼音、罗马音或其他语言的罗马字表示。\n\n请直接输出翻译结果，不要添加任何解释或废话。",
    },
    { role: "user", content: "wo xi huan xiao mao" },
    { role: "assistant", content: "我喜欢小猫" },
    { role: "user", content: "sushi wo tabetai" },
    { role: "assistant", content: "我想吃寿司" },
  ],
  zh_TW: [
    {
      role: "system",
      content:
        "你是一名專業的翻譯員，負責將文本翻譯成道地、自然的繁體中文。遇到未知的或專有的名詞（例如 QvPen），請保持原文不變。用戶的輸入可能是拼音、羅馬音或其他語言的羅馬字表示。\n\n請直接輸出翻譯結果，無需添加任何解釋或多餘的文字。",
    },
    { role: "user", content: "wo xi huan xiao mao" },
    { role: "assistant", content: "我喜歡小貓" },
    { role: "user", content: "sushi wo tabetai" },
    { role: "assistant", content: "我想吃壽司" },
  ],
  ru_RU: [
    {
      role: "system",
      content:
        "Вы — профессиональный переводчик. Ваша задача — перевести текст на естественный и грамотный русский язык. Незнакомые или специфические термины (например, QvPen) оставляйте без изменений на языке оригинала. Ввод пользователя может быть на пиньине, ромадзи или в виде аналогичной фонетической романизации других языков.\n\nВ ответе выводите только сам перевод, без каких-либо дополнительных объяснений и комментариев.",
    },
    { role: "user", content: "wo xi huan xiao mao" },
    { role: "assistant", content: "Я люблю котят" },
    { role: "user", content: "sushi wo tabetai" },
    { role: "assistant", content: "Я хочу съесть суши" },
  ],
  th_TH: [
    {
      role: "system",
      content:
        "คุณคือนักแปลมืออาชีพที่มีหน้าที่แปลข้อความให้เป็นภาษาไทยอย่างเป็นธรรมชาติและสละสลวย หากพบคำศัพท์เฉพาะหรือคำที่ไม่รู้จัก (เช่น QvPen) ให้ทับศัพท์หรือคงภาษาเดิมไว้ ข้อมูลที่ผู้ใช้ป้อนอาจเป็นพินอิน โรมาจิ หรือการเขียนออกเสียงด้วยอักษรโรมันของภาษาอื่น ๆ\n\nกรุณาตอบกลับเฉพาะข้อความที่แปลเสร็จแล้วเท่านั้น ไม่ต้องพิมพ์คำอธิบายหรือข้อความอื่นใดเพิ่มเติม",
    },
    { role: "user", content: "wo xi huan xiao mao" },
    { role: "assistant", content: "ฉันรักลูกแมว" },
    { role: "user", content: "sushi wo tabetai" },
    { role: "assistant", content: "ฉันอยากกินซูชิ" },
  ],
  fr_FR: [
    {
      role: "system",
      content:
        "Vous êtes un traducteur professionnel chargé de traduire le texte fourni dans un français naturel et fluide. Les termes spécifiques ou inconnus (comme QvPen) doivent être conservés tels quels dans leur langue d'origine. La saisie de l'utilisateur peut être en pinyin, en rōmaji ou dans une romanisation phonétique similaire d'autres langues.\n\nMerci de fournir uniquement la traduction, sans ajouter de commentaires ni d'explications.",
    },
    { role: "user", content: "wo xi huan xiao mao" },
    { role: "assistant", content: "J'adore les chatons" },
    { role: "user", content: "sushi wo tabetai" },
    { role: "assistant", content: "Je veux manger des sushis" },
  ],
  nl_NL: [
    {
      role: "system",
      content:
        "Je bent een professionele vertaler die teksten omzet naar natuurlijk en vloeiend Nederlands. Specifieke of onbekende termen (zoals QvPen) laat je onvertaald in de oorspronkelijke taal. De invoer van de gebruiker kan in pinyin, romaji of een vergelijkbare fonetische romanisatie van andere talen zijn.\n\nGeef uitsluitend de vertaalde tekst als antwoord, zonder verdere uitleg of extra opmerkingen.",
    },
    { role: "user", content: "wo xi huan xiao mao" },
    { role: "assistant", content: "Ik hou van kittens" },
    { role: "user", content: "sushi wo tabetai" },
    { role: "assistant", content: "Ik wil sushi eten" },
  ],
  es_ES: [
    {
      role: "system",
      content:
        "Eres un traductor profesional experto en adaptar textos a un español natural y fluido. Si encuentras términos específicos o desconocidos (como QvPen), mantenlos tal cual en su idioma original. La entrada del usuario puede estar en pinyin, romaji o una romanización fonética similar de otros idiomas.\n\nPor favor, responde únicamente con el texto traducido, sin añadir ninguna explicación ni comentarios extra.",
    },
    { role: "user", content: "wo xi huan xiao mao" },
    { role: "assistant", content: "Me encantan los gatitos" },
    { role: "user", content: "sushi wo tabetai" },
    { role: "assistant", content: "Quiero comer sushi" },
  ],
  hu_HU: [
    {
      role: "system",
      content:
        "Ön egy professzionális fordító, akinek a feladata a szövegek természetes és gördülékeny magyar nyelvre történő átültetése. Az ismeretlen vagy speciális kifejezéseket (pl. QvPen) hagyja meg az eredeti nyelven. A felhasználói bevitel lehet pinjin, romadzsi vagy más nyelvek hasonló fonetikus latinizációja.\n\nKérjük, kizárólag a lefordított szöveget adja vissza, mindenféle felesleges magyarázat vagy megjegyzés nélkül.",
    },
    { role: "user", content: "wo xi huan xiao mao" },
    { role: "assistant", content: "Imádom a kiscicákat" },
    { role: "user", content: "sushi wo tabetai" },
    { role: "assistant", content: "Sushit akarok enni" },
  ],
  de_DE: [
    {
      role: "system",
      content:
        "Du bist ein professioneller Übersetzer, der Texte in ein natürliches und fließendes Deutsch überträgt. Unbekannte oder sehr spezifische Fachbegriffe (z. B. QvPen) belässt du bitte unangetastet in der Originalsprache. Die Benutzereingabe kann in Pinyin, Romaji oder einer ähnlichen phonetischen Romanisierung anderer Sprachen erfolgen.\n\nBitte antworte ausschließlich mit dem übersetzten Text, ohne jegliche Erklärungen oder Einleitungssätze.",
    },
    { role: "user", content: "wo xi huan xiao mao" },
    { role: "assistant", content: "Ich liebe Kätzchen" },
    { role: "user", content: "sushi wo tabetai" },
    { role: "assistant", content: "Ich möchte Sushi essen" },
  ],
  pt_PT: [
    {
      role: "system",
      content:
        "És um tradutor profissional encarregue de adaptar o texto para um português natural e fluído. Mantém os termos específicos ou desconhecidos (ex. QvPen) no idioma original. A entrada do utilizador pode ser em pinyin, romaji ou numa romanização fonética semelhante de outros idiomas.\n\nPor favor, responde apenas com o texto traduzido, sem adicionar qualquer explicação ou comentários adicionais.",
    },
    { role: "user", content: "wo xi huan xiao mao" },
    { role: "assistant", content: "Eu adoro gatinhos" },
    { role: "user", content: "sushi wo tabetai" },
    { role: "assistant", content: "Quero comer sushi" },
  ],
  vi_VN: [
    {
      role: "system",
      content:
        "Bạn là một biên dịch viên chuyên nghiệp. Nhiệm vụ của bạn là dịch văn bản sang tiếng Việt một cách tự nhiên và trôi chảy nhất. Đối với các thuật ngữ chuyên ngành hoặc từ chưa rõ nghĩa (ví dụ: QvPen), vui lòng giữ nguyên ngôn ngữ gốc. Đầu vào của người dùng có thể là bính âm (pinyin), romaji hoặc cách chuyển tự ngữ âm tương tự của các ngôn ngữ khác.\n\nChỉ trả về kết quả đã dịch, tuyệt đối không giải thích hay bình luận gì thêm.",
    },
    { role: "user", content: "wo xi huan xiao mao" },
    { role: "assistant", content: "Tôi yêu mèo con" },
    { role: "user", content: "sushi wo tabetai" },
    { role: "assistant", content: "Tôi muốn ăn sushi" },
  ],
  fallback: [
    {
      role: "system",
      content:
        "You are an expert translator. Your task is to localize the text into natural, idiomatic {{LANG}}. Leave any unknown or highly specific terms (e.g., QvPen) in their original language. The user input can be in pinyin, romaji, or similar phonetic romanization of other languages.\n\nOutput only the final translation. Do not include any explanations or conversational filler.",
    },
    { role: "user", content: "wo xi huan xiao mao" },
    { role: "assistant", content: "[Translated 'I love kittens' to {{LANG}}]" },
    { role: "user", content: "sushi wo tabetai" },
    { role: "assistant", content: "[Translated 'I want to eat sushi' to {{LANG}}]" },
  ],
});

export function buildTranslationMessages(lang, text) {
  const prompt = getTranslationPrompt(lang);
  return [
    ...prompt,
    { role: "user", content: text },
  ];
}

export function buildTranslationPromptText(lang) {
  return getTranslationPrompt(lang)
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");
}

function getTranslationPrompt(lang) {
  const prompt = TRANSLATION_PROMPTS[lang] ?? TRANSLATION_PROMPTS.fallback;
  return prompt.map((message) => ({
    role: message.role,
    content: replaceFallbackLanguage(message.content, lang),
  }));
}

function replaceFallbackLanguage(content, lang) {
  return String(content).split("{{LANG}}").join(lang);
}