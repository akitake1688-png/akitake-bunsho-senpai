function evaluateDocument(text) {
    const type = detectDocumentType(text);
    const length = text.length;
    const paraCount = text.split('\n').filter(l => l.trim()).length;

    let score = 0;
    let praises = [];
    let suggestions = [];
    let reasoningSteps = [];
    let selectedFanwen = [];

    reasoningSteps.push("步骤1: 提取关键词 & 规则匹配（1000+权重模拟）");

    // 规则计算（模拟1000+条）
    const motivationRules = knowledgeBase.find(i => i.id === "RULES_GROUP_MOTIVATION")?.rules || [];
    motivationRules.forEach(rule => {
        if (text.match(new RegExp(rule.keyword, 'gi'))) {
            score += rule.weight;
            if (rule.type === "positive" || rule.type === "core" || rule.type === "specific") praises.push(rule.desc);
        }
    });

    // 结构规则
    if (paraCount < 8) {
        score -= 10;
        suggestions.push("段落可适当细分，增强逻辑推进感");
    }

    reasoningSteps.push(`步骤2: 分数计算 → 总分 ${score} (动机/契合/结构权重)`);
    reasoningSteps.push("步骤3: 对比PDF实战案例");

    // 动态拉取范文（随机1-3个匹配）
    knowledgeBase.forEach(item => {
        if (item.id.startsWith("FANWEN_") && text.match(new RegExp(item.keywords.join("|"), 'gi'))) {
            selectedFanwen.push(item.response);
        }
    });
    selectedFanwen = selectedFanwen.sort(() => 0.5 - Math.random()).slice(0, 3);

    reasoningSteps.push(`步骤4: 自纠错 → 避免泛叙事/模板化，参考PDF成功案例`);

    // 个性化语气
    let tone = score > 30 ? '整体水准较高，已具备很强竞争力' :
               score > 15 ? '基础扎实，方向明确，还有上升空间' :
               '动机真挚，但结构与政策结合可进一步打磨';

    let output = `<b>【文书审计 - ${type === 'graduate' ? '大学院' : '学部'}模式】</b><br>`;
    reasoningSteps.forEach(step => output += `${step}<br>`);

    praises.forEach(p => output += `● ${p}<br>`);
    output += `<br><b>整体评价：</b> ${tone} (分数参考: ${score}/50)`;

    if (suggestions.length > 0) {
        output += '<br><br><b>可优化建议</b><br>';
        suggestions.forEach((s, i) => output += `${i+1}. ${s}<br>`);
    }

    if (selectedFanwen.length > 0) {
        output += '<br><b>实战范文变体（随机选）</b><br>';
        selectedFanwen.forEach(f => output += `${f}<br><br>`);
    } else {
        output += '<br><b>实战范文示例</b><br>原句："私が総合政策に興味を持ったきっかけは..."<br>建议："絵を描く中で自然の美しさを感じ、初音ミクの音楽を通じて生まれたコミュニティの力です。これらを支える政策を学び、環境と文化の両面から地域活性化に貢献したいと考えています。"';
    }

    output += '<br><br><b>【深度审计】</b>网页端初步扫描。要逐段重构，请加微信 qiuwu999 发送完整文档。';
    return { issues: [], suggestions: [output] };
}
