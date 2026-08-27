/**
 * 英语学习工作台 — 课程数据 + 生成引擎
 * 
 * 内容结构：
 *   - 4 个手工单元（日常对话 / 语法专题 / 商务英语 / 词汇拓展）= 14 课
 *   - 1 个旅游英语单元 = 8 课
 *   - 52 周生成式课程 = 364 课
 *   合计 386 课，每天 1-2 课可用满一整年
 *
 * 题型：choice 选择 / fill 填空 / listen 听音 / match 配对 / order 排序
 */

// ============ 工具函数 ============
function _shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function _pick(arr, n) {
  return _shuffle(arr).slice(0, n);
}

// 从词库生成选择题（看中文选英文）
function _genChoice(words, count) {
  const qs = [];
  const pool = _pick(words, Math.min(count, words.length));
  pool.forEach(w => {
    const distractors = words.filter(x => x[0] !== w[0]);
    const wrong = _pick(distractors, 3).map(x => x[0]);
    const options = _shuffle([w[0], ...wrong]);
    qs.push({
      type: "choice",
      prompt: `"${w[1]}" 用英语怎么说？`,
      options: options,
      answer: options.indexOf(w[0])
    });
  });
  return qs;
}

// 从词库生成配对题
function _genMatch(words, count) {
  const pairs = _pick(words, Math.min(count, words.length));
  return [{
    type: "match",
    prompt: "将中英文配对",
    pairs: pairs.map(p => [p[0], p[1]]),
    answer: null
  }];
}

// 从词库生成听力题
function _genListen(words, count) {
  const qs = [];
  const pool = _pick(words, Math.min(count, words.length));
  pool.forEach(w => {
    const distractors = words.filter(x => x[0] !== w[0]);
    const wrong = _pick(distractors, 3).map(x => x[0]);
    const options = _shuffle([w[0], ...wrong]);
    qs.push({
      type: "listen",
      prompt: "听完后选择你听到的内容",
      audio: w[0],
      options: options,
      answer: options.indexOf(w[0])
    });
  });
  return qs;
}

// 从例句生成填空题
function _genFill(sentences, count) {
  const qs = [];
  const pool = _pick(sentences, Math.min(count, sentences.length));
  pool.forEach(s => {
    const sentence = s[0];
    const answer = s[1];
    const distractors = ["quickly", "suddenly", "carefully", "usually", "completely",
      "probably", "actually", "eventually", "finally", "generally",
      "currently", "recently", "previously", "immediately", "certainly"];
    const wrong = _pick(distractors.filter(d => d !== answer), 3);
    const options = _shuffle([answer, ...wrong]);
    qs.push({
      type: "fill",
      prompt: sentence,
      options: options,
      answer: options.indexOf(answer),
      hint: null
    });
  });
  return qs;
}

// 从例句生成排序题
function _genOrder(sentences, count) {
  const qs = [];
  const pool = _pick(sentences, Math.min(count, sentences.length));
  pool.forEach(s => {
    const fullSentence = s[0].replace("___", s[1]);
    const words = fullSentence.split(" ");
    qs.push({
      type: "order",
      prompt: "将单词排成正确的句子",
      words: words,
      answer: fullSentence
    });
  });
  return qs;
}

// 从词库生成"看英文选中文"选择题
function _genChoiceReverse(words, count) {
  const qs = [];
  const pool = _pick(words, Math.min(count, words.length));
  pool.forEach(w => {
    const distractors = words.filter(x => x[1] !== w[1]);
    const wrong = _pick(distractors, 3).map(x => x[1]);
    const options = _shuffle([w[1], ...wrong]);
    qs.push({
      type: "choice",
      prompt: `"${w[0]}" 是什么意思？`,
      options: options,
      answer: options.indexOf(w[1])
    });
  });
  return qs;
}

// ============ 52 周词汇库 ============
// 每周：主题、图标、颜色、12组词对、3个例句（含填空答案）
const WEEKLY_VOCAB = [
  {t:"日常作息",i:"⏰",c:"#58cc02",w:[["alarm clock","闹钟"],["brush teeth","刷牙"],["make the bed","铺床"],["get dressed","穿好衣服"],["commute","通勤"],["leave home","离家"],["come home","回家"],["take a shower","洗澡"],["have breakfast","吃早餐"],["set the table","摆餐具"],["do laundry","洗衣服"],["feed the pet","喂宠物"]],s:[["I always set my ___ for 6:30","alarm"],["She ___ to work by subway every day","commutes"],["He takes a ___ before going to bed","shower"]]},
  {t:"家庭关系",i:"👨‍👩‍👧",c:"#1cb0f6",w:[["sibling","兄弟姐妹"],["relative","亲戚"],["generation","代"],["in-laws","姻亲"],["twins","双胞胎"],["adopted","收养的"],["nuclear family","核心家庭"],["extended family","大家庭"],["upbringing","教养"],["to raise","抚养"],["to look after","照顾"],["bond","纽带"]],s:[["My ___ is two years older than me","sibling"],["She was ___ by her grandparents","raised"],["We have a strong family ___","bond"]]},
  {t:"个人爱好",i:"🎯",c:"#ce82ff",w:[["photography","摄影"],["calligraphy","书法"],["pottery","陶艺"],["origami","折纸"],["gardening","园艺"],["knitting","编织"],["birdwatching","观鸟"],["stargazing","观星"],["scrapbooking","剪贴簿"],["collect stamps","集邮"],["play chess","下棋"],["sketching","素描"]],s:[["I enjoy ___ in my free time","photography"],["She has been ___ stamps since childhood","collecting"],["They took up ___ last summer","gardening"]]},
  {t:"家居生活",i:"🏠",c:"#ff9600",w:[["mortgage","房贷"],["tenant","租客"],["landlord","房东"],["furnish","布置家具"],["renovate","翻新"],["decorate","装饰"],["appliance","家电"],["plumbing","管道"],["attic","阁楼"],["basement","地下室"],["balcony","阳台"],["cozy","温馨的"]],s:[["We need to ___ the kitchen this year","renovate"],["The ___ lives upstairs and is very kind","landlord"],["Our living room feels very ___","cozy"]]},
  {t:"友谊社交",i:"🤝",c:"#58cc02",w:[["bond","纽带"],["mutual","相互的"],["loyal","忠诚的"],["supportive","支持的"],["keep in touch","保持联系"],["drift apart","渐渐疏远"],["have in common","有共同点"],["confide in","倾诉"],["back up","支持"],["break the ice","打破僵局"],["catch up","叙旧"],["trust","信任"]],s:[["We try to ___ with old friends","keep in touch"],["Let me ___ you ___ on this deal","back","up"],["It takes time to ___ the ___ at parties","break","ice"]]},
  {t:"情感表达",i:"😊",c:"#1cb0f6",w:[["frustrated","沮丧的"],["overwhelmed","不知所措的"],["grateful","感激的"],["content","满足的"],["anxious","焦虑的"],["relieved","宽慰的"],["embarrassed","尴尬的"],["thrilled","兴奋的"],["guilty","内疚的"],["nostalgic","怀旧的"],["sympathetic","同情的"],["envious","羡慕的"]],s:[["I feel ___ for all your help","grateful"],["She was ___ about the exam results","anxious"],["He looked ___ after the mistake","embarrassed"]]},
  {t:"派对聚会",i:"🎉",c:"#ce82ff",w:[["host","主办"],["RSVP","回复邀请"],["potluck","百乐餐"],["toast","祝酒"],["mingle","交际"],["icebreaker","破冰活动"],["venue","场地"],["cater","承办酒席"],["playlist","播放列表"],["dress code","着装要求"],["plus one","携伴"],["decoration","装饰"]],s:[["She will ___ the party this weekend","host"],["Please ___ by Friday so we know the headcount","RSVP"],["The ___ is casual for this event","dress code"]]},
  {t:"闲聊技巧",i:"💬",c:"#ff9600",w:[["small talk","闲聊"],["compliment","赞美"],["open-ended","开放式的问题"],["active listening","积极倾听"],["body language","肢体语言"],["eye contact","眼神交流"],["conversation starter","话题开头"],["topic changer","转移话题"],["current events","时事"],["weekend plans","周末计划"],["common ground","共同点"],["awkward silence","尴尬的沉默"]],s:[["Making ___ is an important social skill","small talk"],["She gave him a ___ on his new tie","compliment"],["There was an ___ ___ between them","awkward","silence"]]},
  {t:"求职面试",i:"📋",c:"#58cc02",w:[["resume","简历"],["cover letter","求职信"],["qualification","资质"],["reference","推荐人"],["strength","优势"],["weakness","劣势"],["salary expectation","薪资期望"],["probation period","试用期"],["background check","背景调查"],["onboarding","入职培训"],["candidate","候选人"],["shortlist","入围名单"]],s:[["I need to update my ___ before applying","resume"],["The ___ asked about my ___ and weaknesses","candidate","strength"],["During the ___ ___ I learned the company culture","probation","period"]]},
  {t:"办公室英语",i:"🏢",c:"#1cb0f6",w:[["deadline","截止日期"],["assign","分配"],["collaborate","协作"],["feedback","反馈"],["agenda","议程"],["prioritize","优先处理"],["delegate","委派"],["follow up","跟进"],["brainstorm","头脑风暴"],["out of office","不在办公室"],["stand-up meeting","站会"],["action item","待办事项"]],s:[["We need to ___ the most important tasks first","prioritize"],["The ___ for today covers three items","agenda"],["Let me ___ ___ on that email I sent yesterday","follow","up"]]},
  {t:"团队合作",i:"🤝",c:"#ce82ff",w:[["synergy","协同效应"],["compromise","妥协"],["consensus","共识"],["role","角色"],["responsibility","责任"],["contribution","贡献"],["conflict resolution","冲突解决"],["brainstorming","头脑风暴"],["accountability","问责制"],["coordination","协调"],["support","支持"],["collaboration","合作"]],s:[["We reached a ___ after long discussion","consensus"],["Everyone should take ___ for their part","responsibility"],["Good ___ ___ skills are essential here","conflict","resolution"]]},
  {t:"领导力",i:"📊",c:"#ff9600",w:[["vision","愿景"],["motivate","激励"],["mentor","导师"],["empower","赋能"],["strategic","战略性的"],["decision-making","决策"],["integrity","正直"],["inspire","鼓舞"],["initiative","主动性"],["adaptability","适应力"],["delegate","授权"],["feedback","反馈"]],s:[["A good leader can ___ the team to succeed","motivate"],["She has a clear ___ for the company","vision"],["His ___ earned everyone's trust","integrity"]]},
  {t:"学校教育",i:"📚",c:"#58cc02",w:[["enrollment","注册"],["tuition","学费"],["scholarship","奖学金"],["syllabus","教学大纲"],["assignment","作业"],["thesis","论文"],["credit","学分"],["elective","选修课"],["semester","学期"],["plagiarism","抄袭"],["graduation","毕业"],["extracurricular","课外活动"]],s:[["She received a full ___ to study abroad","scholarship"],["The ___ includes three essays and a final exam","syllabus"],["He joined several ___ clubs after class","extracurricular"]]},
  {t:"考试备考",i:"✏️",c:"#1cb0f6",w:[["cram","突击复习"],["review","复习"],["flashcard","抽认卡"],["mock exam","模拟考"],["multiple choice","多选题"],["essay question","问答题"],["time management","时间管理"],["study guide","学习指南"],["grading curve","成绩曲线"],["retake","补考"],["pass with flying colors","高分通过"],["buckle down","埋头苦干"]],s:[["Don't ___ the night before the exam","cram"],["She used ___ to memorize vocabulary","flashcards"],["He managed to ___ with ___ ___","pass","flying","colors"]]},
  {t:"学习方法",i:"🧠",c:"#ce82ff",w:[["spaced repetition","间隔重复"],["active recall","主动回忆"],["mind map","思维导图"],["summarize","总结"],["teach others","教别人"],["practice test","模拟测试"],["pomodoro","番茄工作法"],["note-taking","记笔记"],["highlight","标注"],["annotate","批注"],["mnemonics","记忆法"],["quiz yourself","自测"]],s:[["___ ___ helps you remember things longer","Spaced","repetition"],["I use the ___ technique to stay focused","pomodoro"],["Making a ___ ___ helps me understand topics","mind","map"]]},
  {t:"学术写作",i:"📝",c:"#ff9600",w:[["thesis statement","论点"],["citation","引用"],["plagiarism","抄袭"],["abstract","摘要"],["methodology","方法论"],["literature review","文献综述"],["peer-reviewed","同行评审的"],["paraphrase","改写"],["bibliography","参考文献"],["conclusion","结论"],["evidence","证据"],["draft","草稿"]],s:[["Your ___ ___ should be clear and concise","thesis","statement"],["You must cite all sources in the ___","bibliography"],["The ___ summarizes the entire paper","abstract"]]},
  {t:"机场海关",i:"✈️",c:"#58cc02",w:[["boarding pass","登机牌"],["departure gate","登机口"],["customs declaration","海关申报"],["carry-on","随身行李"],["check-in counter","值机柜台"],["duty-free","免税的"],["layover","中转"],["delayed","延误的"],["terminal","航站楼"],["baggage claim","行李提取"],["passport control","护照检查"],["security check","安检"]],s:[["Please have your ___ ___ ready","boarding","pass"],["Our flight is ___ by two hours","delayed"],["I bought perfume at the ___-___ shop","duty","free"]]},
  {t:"酒店住宿",i:"🏨",c:"#1cb0f6",w:[["reservation","预订"],["check-in","入住"],["check-out","退房"],["room service","客房服务"],["front desk","前台"],["housekeeping","客房服务"],["minibar","迷你吧"],["amenities","设施"],["continental breakfast","欧式早餐"],["late checkout","延迟退房"],["suite","套房"],["concierge","礼宾部"]],s:[["I'd like to make a ___ for three nights","reservation"],["The ___ is available 24 hours a day","front desk"],["Please call ___ for extra towels","housekeeping"]]},
  {t:"观光游览",i:"📸",c:"#ce82ff",w:[["landmark","地标"],["itinerary","行程"],["tour guide","导游"],["souvenir","纪念品"],["admission fee","门票"],["opening hours","开放时间"],["guided tour","导览"],["self-guided","自助的"],["photo spot","拍照点"],["off-season","淡季"],["UNESCO site","世界遗产"],["tourist trap","旅游陷阱"]],s:[["The ___ is a must-see in this city","landmark"],["We bought a small ___ from the local market","souvenir"],["___ are usually lower during the ___","Admission fees","off-season"]]},
  {t:"公共交通",i:"🚌",c:"#ff9600",w:[["fare","车费"],["transfer","换乘"],["timetable","时刻表"],["platform","站台"],["delay","延误"],["express train","快车"],["monthly pass","月票"],["rush hour","高峰时段"],["single ticket","单程票"],["validate","验票"],["conductor","列车员"],["accessible","无障碍的"]],s:[["The ___ is cheaper if you buy a ___ ___","fare","monthly pass"],["Trains are crowded during ___ ___","rush hour"],["Please ___ your ticket before boarding","validate"]]},
  {t:"烹饪美食",i:"🍳",c:"#58cc02",w:[["simmer","慢炖"],["sauté","翻炒"],["grill","烤"],["bake","烘焙"],["marinate","腌制"],["chop","切碎"],["whisk","搅拌"],["season","调味"],["boil","煮沸"],["steam","蒸"],["preheat","预热"],["garnish","装饰"]],s:[["First ___ the onions until golden","sauté"],["Please ___ the oven to 180 degrees","preheat"],["Let the soup ___ for 20 minutes","simmer"]]},
  {t:"餐厅用语",i:"🍽️",c:"#1cb0f6",w:[["appetizer","开胃菜"],["main course","主菜"],["dessert","甜点"],["bill","账单"],["tip","小费"],["reservation","预订"],["waitress","女服务员"],["chef's special","主厨推荐"],["takeout","外带"],["dine-in","堂食"],["table for two","两人桌"],["no reservation","未预订"]],s:[["I'd like a ___ ___ by the window","table for two"],["Would you like to see the ___ ___?","chef's special"],["Can we get the ___ please?","bill"]]},
  {t:"食材调料",i:"🥘",c:"#ce82ff",w:[["olive oil","橄榄油"],["soy sauce","酱油"],["garlic","大蒜"],["ginger","生姜"],["flour","面粉"],["sugar","糖"],["salt","盐"],["pepper","胡椒"],["vinegar","醋"],["butter","黄油"],["onion","洋葱"],["tomato","番茄"]],s:[["Heat the ___ ___ in a pan first","olive oil"],["Add minced ___ and ___ for flavor","garlic","ginger"],["Mix ___ and water to make dough","flour"]]},
  {t:"饮食偏好",i:"🥗",c:"#ff9600",w:[["vegetarian","素食者"],["vegan","纯素食者"],["gluten-free","无麸质"],["lactose intolerant","乳糖不耐受"],["allergy","过敏"],["organic","有机的"],["low-carb","低碳水"],["halal","清真的"],["kosher","犹太教的"],["keto","生酮的"],["dairy-free","无乳制品"],["nut allergy","坚果过敏"]],s:[["I'm ___ so I don't eat meat","vegetarian"],["She is ___ ___ and avoids bread","gluten-free"],["He has a ___ ___ to peanuts","nut allergy"]]},
  {t:"身体症状",i:"🤒",c:"#58cc02",w:[["fever","发烧"],["cough","咳嗽"],["sore throat","喉咙痛"],["headache","头痛"],["nausea","恶心"],["dizziness","头晕"],["rash","皮疹"],["swelling","肿胀"],["fatigue","疲劳"],["runny nose","流鼻涕"],["stomachache","胃痛"],["back pain","背痛"]],s:[["I have a ___ ___ and can't swallow","sore throat"],["She felt ___ and had to sit down","dizziness"],["The ___ spread across his arm","rash"]]},
  {t:"就医买药",i:"💊",c:"#1cb0f6",w:[["prescription","处方"],["pharmacy","药房"],["dosage","剂量"],["side effect","副作用"],["antibiotics","抗生素"],["appointment","预约"],["blood pressure","血压"],["injection","注射"],["check-up","体检"],["symptom","症状"],["insurance","保险"],["blood test","验血"]],s:[["You need a ___ for this medicine","prescription"],["The ___ may cause drowsiness","side effect"],["I have an ___ with Dr. Smith","appointment"]]},
  {t:"健身运动",i:"💪",c:"#ce82ff",w:[["cardio","有氧运动"],["strength training","力量训练"],["warm-up","热身"],["cool down","放松"],["reps","次数"],["sets","组数"],["personal trainer","私人教练"],["treadmill","跑步机"],["dumbbell","哑铃"],["yoga","瑜伽"],["stretching","拉伸"],["metabolism","新陈代谢"]],s:[["Always ___ before exercising","warm-up"],["She does 3 ___ of 12 ___ each","sets","reps"],["___ is great for heart health","Cardio"]]},
  {t:"心理健康",i:"🧘",c:"#ff9600",w:[["stress","压力"],["anxiety","焦虑"],["depression","抑郁"],["mindfulness","正念"],["meditation","冥想"],["therapy","治疗"],["self-care","自我关怀"],["burnout","倦怠"],["coping mechanism","应对机制"],["resilience","韧性"],["journaling","写日记"],["support group","互助小组"]],s:[["___ helps me manage daily ___","Meditation","stress"],["She practices ___ to stay present","mindfulness"],["After months of ___ she took a break","burnout"]]},
  {t:"网絡科技",i:"🌐",c:"#58cc02",w:[["broadband","宽带"],["download","下载"],["upload","上传"],["browser","浏览器"],["search engine","搜索引擎"],["hyperlink","超链接"],["bookmark","书签"],["tab","标签页"],["cache","缓存"],["cookie","Cookie"],["firewall","防火墙"],["bandwidth","带宽"]],s:[["The ___ speed is much faster now","download"],["Clear your browser ___ to fix the issue","cache"],["A ___ protects your computer","firewall"]]},
  {t:"电子设备",i:"📱",c:"#1cb0f6",w:[["smartphone","智能手机"],["tablet","平板电脑"],["laptop","笔记本电脑"],["charger","充电器"],["headphones","耳机"],["screen protector","屏幕保护膜"],["battery life","电池续航"],["storage","存储"],["operating system","操作系统"],["update","更新"],["factory reset","恢复出厂设置"],["wireless","无线的"]],s:[["My ___ ___ lasts all day","battery life"],["Please install the latest ___","update"],["I need a ___ for my phone","charger"]]},
  {t:"社交媒体",i:"📲",c:"#ce82ff",w:[["post","发布"],["like","点赞"],["share","分享"],["comment","评论"],["follow","关注"],["unfriend","删好友"],["hashtag","话题标签"],["viral","疯传的"],["feed","信息流"],["profile","个人主页"],["DM","私信"],["story","快拍"]],s:[["Her video went ___ overnight","viral"],["I ___ my friend on Instagram","follow"],["Use a ___ to reach more people","hashtag"]]},
  {t:"网絡安全",i:"🔒",c:"#ff9600",w:[["password","密码"],["phishing","钓鱼攻击"],["malware","恶意软件"],["encryption","加密"],["firewall","防火墙"],["two-factor","双因素认证"],["backup","备份"],["VPN","虚拟专用网"],["hacker","黑客"],["data breach","数据泄露"],["privacy","隐私"],["secure","安全的"]],s:[["Use ___ authentication for extra security","two-factor"],["___ emails try to steal your information","Phishing"],["Always ___ your important files","backup"]]},
  {t:"銀行金融",i:"🏦",c:"#58cc02",w:[["account","账户"],["deposit","存款"],["withdraw","取款"],["transfer","转账"],["balance","余额"],["interest","利息"],["loan","贷款"],["mortgage","房贷"],["credit card","信用卡"],["debit card","借记卡"],["statement","对账单"],["overdraft","透支"]],s:[["I need to ___ some cash from the ATM","withdraw"],["The ___ on this account is 3%","interest"],["She checked her bank ___ online","statement"]]},
  {t:"预算理财",i:"💰",c:"#1cb0f6",w:[["budget","预算"],["savings","存款"],["expenses","开支"],["income","收入"],["invest","投资"],["compound interest","复利"],["emergency fund","应急基金"],["frugal","节俭的"],["splurge","挥霍"],["bargain","便宜货"],["discount","折扣"],["financial plan","理财计划"]],s:[["I set a monthly ___ to track my ___","budget","expenses"],["It's wise to have an ___ ___","emergency fund"],["___ ___ grows your money over time","Compound interest"]]},
  {t:"投资入门",i:"📈",c:"#ce82ff",w:[["stock","股票"],["bond","债券"],["mutual fund","共同基金"],["dividend","股息"],["portfolio","投资组合"],["risk","风险"],["return","回报"],["diversify","分散投资"],["bull market","牛市"],["bear market","熊市"],["index fund","指数基金"],["broker","经纪人"]],s:[["Don't put all eggs in one basket — ___!","diversify"],["A ___ market means prices are rising","bull"],["She received a ___ from her shares","dividend"]]},
  {t:"购物消费",i:"🛒",c:"#ff9600",w:[["discount","折扣"],["coupon","优惠券"],["bargain","便宜货"],["refund","退款"],["exchange","换货"],["receipt","收据"],["warranty","保修"],["installment","分期付款"],["impulse buy","冲动消费"],["window shopping","橱窗购物"],["clearance","清仓"],["loyalty card","会员卡"]],s:[["Can I get a ___ for this item?","refund"],["Keep the ___ for the warranty","receipt"],["I made an ___ ___ at the checkout","impulse buy"]]},
  {t:"天气气候",i:"🌤️",c:"#58cc02",w:[["forecast","天气预报"],["humidity","湿度"],["thunderstorm","雷暴"],["drizzle","毛毛雨"],["overcast","阴天的"],["breeze","微风"],["temperature","温度"],["Fahrenheit","华氏度"],["Celsius","摄氏度"],["climate change","气候变化"],["drought","干旱"],["flood","洪水"]],s:[["The ___ says it will rain tomorrow","forecast"],["Today is ___ with no sun","overcast"],["Global temperatures are rising due to ___ ___","climate change"]]},
  {t:"动物世界",i:"🐾",c:"#1cb0f6",w:[["mammal","哺乳动物"],["reptile","爬行动物"],["amphibian","两栖动物"],["habitat","栖息地"],["endangered","濒危的"],["predator","捕食者"],["prey","猎物"],["domesticated","驯化的"],["wildlife","野生动物"],["species","物种"],["extinction","灭绝"],["conservation","保护"]],s:[["The panda is an ___ species","endangered"],["Lions are ___ and hunt for food","predators"],["We must protect their natural ___","habitat"]]},
  {t:"环保可持续",i:"♻️",c:"#ce82ff",w:[["recycle","回收"],["compost","堆肥"],["renewable","可再生的"],["solar panel","太阳能板"],["carbon footprint","碳足迹"],["biodegradable","可生物降解的"],["emission","排放"],["sustainability","可持续性"],["zero waste","零废弃"],["deforestation","砍伐森林"],["pollution","污染"],["greenhouse gas","温室气体"]],s:[["We should ___ plastic and paper","recycle"],["Solar panels use ___ energy","renewable"],["Reducing your ___ ___ helps the planet","carbon footprint"]]},
  {t:"地理自然",i:"🗺️",c:"#ff9600",w:[["continent","大洲"],["ocean","海洋"],["mountain","山脉"],["valley","山谷"],["desert","沙漠"],["peninsula","半岛"],["equator","赤道"],["hemisphere","半球"],["latitude","纬度"],["longitude","经度"],["altitude","海拔"],["terrain","地形"]],s:[["Africa is a ___ south of Europe","continent"],["The ___ divides north and south","equator"],["Mount Everest has the highest ___ in the world","altitude"]]},
  {t:"音乐艺术",i:"🎵",c:"#58cc02",w:[["melody","旋律"],["rhythm","节奏"],["lyrics","歌词"],["chorus","副歌"],["verse","主歌"],["instrument","乐器"],["orchestra","管弦乐队"],["concert","音乐会"],["genre","流派"],["compose","作曲"],["harmony","和声"],["album","专辑"]],s:[["The ___ of this song is very catchy","melody"],["She plays three musical ___","instruments"],["I went to a ___ last weekend","concert"]]},
  {t:"电影娱乐",i:"🎬",c:"#1cb0f6",w:[["director","导演"],["cast","演员阵容"],["plot","剧情"],["trailer","预告片"],["sequel","续集"],["box office","票房"],["special effects","特效"],["soundtrack","原声带"],["genre","类型"],["screening","放映"],["review","影评"],["blockbuster","大片"]],s:[["The ___ of the movie kept me guessing","plot"],["This summer's ___ broke records","blockbuster"],["The ___ were incredibly realistic","special effects"]]},
  {t:"文学阅读",i:"📖",c:"#ce82ff",w:[["novel","小说"],["chapter","章节"],["character","角色"],["plot twist","情节转折"],["fiction","虚构"],["non-fiction","非虚构"],["author","作者"],["memoir","回忆录"],["poetry","诗歌"],["anthology","选集"],["protagonist","主角"],["narrative","叙述"]],s:[["The ___ in this ___ is very brave","protagonist","novel"],["I prefer ___ to fiction","non-fiction"],["The ___ at the end surprised everyone","plot twist"]]},
  {t:"传统文化",i:"🎎",c:"#ff9600",w:[["heritage","遗产"],["customs","习俗"],["ritual","仪式"],["festival","节日"],["ancestor","祖先"],["folklore","民间传说"],["ceremony","典礼"],["parade","游行"],["hand down","传下来"],["cultural identity","文化认同"],["traditional","传统的"],["generation","代"]],s:[["This ___ has been ___ for centuries","festival","handed down"],["They perform a special ___ at the wedding","ritual"],["Our ___ connects us to our ancestors","cultural identity"]]},
  {t:"新闻时事",i:"📰",c:"#58cc02",w:[["headline","标题"],["journalist","记者"],["broadcast","广播"],["editorial","社论"],["breaking news","突发新闻"],["press conference","新闻发布会"],["coverage","报道"],["source","来源"],["unbiased","客观的"],["circulation","发行量"],["correspondent","通讯员"],["headline","头条"]],s:[["The ___ news interrupted the program","breaking"],["The ___ wrote a fair and ___ report","journalist","unbiased"],["The ___ on the front page caught my eye","headline"]]},
  {t:"社会议题",i:"🌍",c:"#1cb0f6",w:[["inequality","不平等"],["poverty","贫困"],["discrimination","歧视"],["immigration","移民"],["housing","住房"],["healthcare","医疗"],["education gap","教育差距"],["unemployment","失业"],["minimum wage","最低工资"],["welfare","福利"],["homelessness","无家可归"],["social justice","社会正义"]],s:[["___ remains a big challenge worldwide","Poverty"],["The government raised the ___ ___","minimum wage"],["We need to fight ___ in all forms","discrimination"]]},
  {t:"科学研究",i:"🔬",c:"#ce82ff",w:[["hypothesis","假设"],["experiment","实验"],["variable","变量"],["conclusion","结论"],["data","数据"],["theory","理论"],["peer review","同行评审"],["publish","发表"],["lab","实验室"],["sample","样本"],["control group","对照组"],["observation","观察"]],s:[["The scientist tested her ___ with an ___","hypothesis","experiment"],["The ___ group received no treatment","control"],["They analyzed the ___ carefully","data"]]},
  {t:"全球议题",i:"🌐",c:"#ff9600",w:[["climate change","气候变化"],["globalization","全球化"],["refugee crisis","难民危机"],["trade war","贸易战"],["pandemic","大流行"],["human rights","人权"],["sustainable development","可持续发展"],["United Nations","联合国"],["treaty","条约"],["summit","峰会"],["sanctions","制裁"],["diplomacy","外交"]],s:[["The ___ ___ affects every country","climate change"],["The two nations signed a peace ___","treaty"],["World leaders met at the annual ___","summit"]]},
  {t:"辯论技巧",i:"🗣️",c:"#58cc02",w:[["argument","论点"],["counter-argument","反驳"],["evidence","证据"],["persuade","说服"],["refute","驳斥"],["concede","让步"],["rhetoric","修辞"],["logical fallacy","逻辑谬误"],["standpoint","立场"],["articulate","清晰表达"],["compelling","有说服力的"],["rebuttal","反驳"]],s:[["She presented a ___ argument","compelling"],["He tried to ___ her main point","refute"],["A good debater can ___ clearly","articulate"]]},
  {t:"演讲表达",i:"🎤",c:"#1cb0f6",w:[["introduction","开场"],["body","正文"],["conclusion","结尾"],["slide","幻灯片"],["audience","听众"],["eye contact","眼神交流"],["gestures","手势"],["pace","语速"],["pause","停顿"],["Q&A","问答环节"],["visual aid","视觉辅助"],["delivery","表达方式"]],s:[["Make ___ ___ with your audience","eye contact"],["She used ___ to support her points","slides"],["End with a strong ___","conclusion"]]},
  {t:"谈判艺术",i:"🤝",c:"#ce82ff",w:[["negotiate","谈判"],["compromise","妥协"],["proposal","提案"],["counter-offer","还价"],["leverage","筹码"],["mutually beneficial","互利的"],["deal-breaker","底线"],["concession","让步"],["terms","条款"],["agreement","协议"],["walk away","退出"],["bottom line","底线"]],s:[["Both sides need to ___ fairly","negotiate"],["This clause is a ___-___ for us","deal","breaker"],["Let's find a ___ ___ solution","mutually beneficial"]]},
  {t:"讲故事",i:"📖",c:"#ff9600",w:[["once upon a time","从前"],["plot","情节"],["setting","背景"],["climax","高潮"],["resolution","结局"],["foreshadowing","伏笔"],["character arc","角色弧光"],["suspense","悬念"],["flashback","倒叙"],["dialogue","对话"],["narrative","叙述"],["twist ending","反转结局"]],s:[["___ a ___ there was a brave knight","Once","upon"],["The ___ of the story is set in space","setting"],["The ___ ___ surprised every reader","twist ending"]]},
];

// ============ 旅游英语单元（手工编写） ============
const TRAVEL_UNIT = {
  id: "travel",
  title: "旅游英语",
  icon: "✈️",
  color: "#ff4b4b",
  lessons: [
    {
      id: "tr1", title: "机场值机与登机", xp: 20,
      questions: [
        { type: "choice", prompt: "值机时工作人员问 \"Window or aisle?\" 是问什么？", options: ["靠窗还是靠走道座位", "头等舱还是经济舱", "大件还是小件行李", "是否需要转机"], answer: 0 },
        { type: "fill", prompt: "I'd like to check in for flight CA123 to ___.", options: ["Beijing", "boarding", "departure", "terminal"], answer: 0 },
        { type: "choice", prompt: "\"Your flight is boarding at Gate B12.\" 意思是？", options: ["你的航班在B12登机口登机", "航班在B12登机口取消", "请在B12登机口候机", "B12登机口已关闭"], answer: 0 },
        { type: "listen", prompt: "听完后选择你听到的句子", audio: "Please proceed to gate B12 for boarding.", options: ["Please proceed to gate B12 for boarding.", "Please proceed to gate A12 for boarding.", "Please return to gate B12 for departure.", "The gate B12 is now closed."], answer: 0 },
        { type: "match", prompt: "将中英文配对", pairs: [["boarding pass","登机牌"],["carry-on","随身行李"],["layover","中转"],["baggage claim","行李提取"]], answer: null },
      ]
    },
    {
      id: "tr2", title: "酒店入住与退房", xp: 20,
      questions: [
        { type: "choice", prompt: "前台问 \"Do you have a reservation?\" 意思是？", options: ["您有预订吗？", "您要预订吗？", "您取消预订吗？", "您想换房吗？"], answer: 0 },
        { type: "fill", prompt: "I'd like to check ___. My name is Li Ming.", options: ["in", "out", "up", "on"], answer: 0 },
        { type: "choice", prompt: "想延迟退房，应该说？", options: ["Could I have a late checkout?", "I want to check out now.", "Can I check in early?", "The room is not clean."], answer: 0 },
        { type: "match", prompt: "将中英文配对", pairs: [["front desk","前台"],["room service","客房服务"],["minibar","迷你吧"],["housekeeping","客房清洁"]], answer: null },
        { type: "listen", prompt: "听完后选择你听到的句子", audio: "Your room number is 506 on the fifth floor.", options: ["Your room number is 506 on the fifth floor.", "Your room number is 560 on the sixth floor.", "Your room number is 505 on the fifth floor.", "Your room is on the fifth floor, number 506."], answer: 0 },
      ]
    },
    {
      id: "tr3", title: "问路与指路", xp: 20,
      questions: [
        { type: "choice", prompt: "\"Go straight and turn left at the second corner.\" 意思是？", options: ["直走，第二个拐角左转", "直走，第二个拐角右转", "左转后直走两个路口", "在第二个路口左转再直走"], answer: 0 },
        { type: "fill", prompt: "Excuse me, how can I get to the nearest ___? (地铁站)", options: ["subway station", "subway sandwich", "subway car", "subway pass"], answer: 0 },
        { type: "choice", prompt: "别人问路时，你想说\"就在对面\"，应该说？", options: ["It's just across the street.", "It's very far away.", "It's behind the building.", "It's on the left side."], answer: 0 },
        { type: "match", prompt: "将中英文配对", pairs: [["straight ahead","正前方"],["crosswalk","人行横道"],["roundabout","环岛"],["dead end","死胡同"]], answer: null },
        { type: "order", prompt: "将单词排成正确的句子", words: ["Go", "straight", "and", "turn", "right", "at", "the", "traffic", "light"], answer: "Go straight and turn right at the traffic light" },
      ]
    },
    {
      id: "tr4", title: "餐厅点餐与买单", xp: 20,
      questions: [
        { type: "choice", prompt: "服务员问 \"Are you ready to order?\" 你想再看看菜单，应该说？", options: ["Could we have a few more minutes?", "I'm not hungry.", "The menu is wrong.", "No, I don't want to eat."], answer: 0 },
        { type: "fill", prompt: "I'd like to ___ the grilled salmon, please. (点)", options: ["order", "eat", "cook", "try"], answer: 0 },
        { type: "choice", prompt: "\"Could we have the bill, please?\" 意思是？", options: ["请结账", "请上菜", "请点单", "请退菜"], answer: 0 },
        { type: "match", prompt: "将中英文配对", pairs: [["appetizer","开胃菜"],["main course","主菜"],["medium rare","五分熟"],["to go","打包带走"]], answer: null },
        { type: "listen", prompt: "听完后选择你听到的句子", audio: "How would you like your steak done?", options: ["How would you like your steak done?", "What kind of steak would you like?", "Would you like some steak?", "How much steak would you like?"], answer: 0 },
      ]
    },
    {
      id: "tr5", title: "购物退税与砍价", xp: 20,
      questions: [
        { type: "fill", prompt: "Is there a ___ on this? I'm a tourist. (退税)", options: ["tax refund", "tax free", "discount", "duty"], answer: 1 },
        { type: "choice", prompt: "想问能不能便宜点，应该说？", options: ["Could you give me a discount?", "This is too expensive.", "I don't want it.", "Can I pay later?"], answer: 0 },
        { type: "choice", prompt: "\"It's a steal!\" 在购物场景中意思是？", options: ["太便宜了/捡到宝了", "被偷了", "不要买", "太贵了"], answer: 0 },
        { type: "match", prompt: "将中英文配对", pairs: [["receipt","收据"],["refund","退款"],["fitting room","试衣间"],["out of stock","缺货"]], answer: null },
        { type: "order", prompt: "将单词排成正确的句子", words: ["Can", "I", "try", "this", "on", "in", "a", "larger", "size"], answer: "Can I try this on in a larger size" },
      ]
    },
    {
      id: "tr6", title: "交通出行与购票", xp: 20,
      questions: [
        { type: "fill", prompt: "I'd like a ___ ticket to the city center, please. (单程)", options: ["single", "double", "return", "round-trip"], answer: 0 },
        { type: "choice", prompt: "\"The next train arrives at platform 3.\" 意思是？", options: ["下一班列车在3号站台到达", "列车从3号站台出发", "3号站台已关闭", "列车延误到3点"], answer: 0 },
        { type: "choice", prompt: "想买日票，应该说？", options: ["I'd like a day pass, please.", "I want one ticket.", "How much is it?", "When does it leave?"], answer: 0 },
        { type: "match", prompt: "将中英文配对", pairs: [["timetable","时刻表"],["platform","站台"],["fare","票价"],["rush hour","高峰时段"]], answer: null },
        { type: "listen", prompt: "听完后选择你听到的句子", audio: "The train to the airport departs every 15 minutes.", options: ["The train to the airport departs every 15 minutes.", "The train to the airport arrives every 50 minutes.", "The bus to the airport departs every 15 minutes.", "The train to the city departs every 15 minutes."], answer: 0 },
      ]
    },
    {
      id: "tr7", title: "紧急情况与就医", xp: 25,
      questions: [
        { type: "choice", prompt: "在国外需要急救，应该拨打什么？", options: ["Emergency number (如911/112)", "Hotel number", "Airline number", "Embassy number"], answer: 0 },
        { type: "fill", prompt: "I need to see a doctor. I feel ___. (头晕)", options: ["dizzy", "happy", "hungry", "sleepy"], answer: 0 },
        { type: "choice", prompt: "在药房想买止痛药，应该说？", options: ["Do you have painkillers?", "I want some candy.", "The doctor is not here.", "Can I see the menu?"], answer: 0 },
        { type: "match", prompt: "将中英文配对", pairs: [["pharmacy","药房"],["prescription","处方"],["insurance card","保险卡"],["emergency room","急诊室"]], answer: null },
        { type: "order", prompt: "将单词排成正确的句子", words: ["I", "need", "to", "see", "a", "doctor", "urgently"], answer: "I need to see a doctor urgently" },
      ]
    },
    {
      id: "tr8", title: "观光游览与拍照", xp: 25,
      questions: [
        { type: "choice", prompt: "想请别人帮忙拍照，应该说？", options: ["Could you take a photo for me?", "Can I borrow your camera?", "This photo is beautiful.", "I don't like photos."], answer: 0 },
        { type: "fill", prompt: "What are the opening ___ of the museum? (开放时间)", options: ["hours", "days", "times", "dates"], answer: 0 },
        { type: "choice", prompt: "\"Is photography allowed here?\" 意思是？", options: ["这里允许拍照吗？", "这里有摄影师吗？", "照片可以买吗？", "这里有相册吗？"], answer: 0 },
        { type: "match", prompt: "将中英文配对", pairs: [["landmark","地标"],["admission fee","门票"],["tour guide","导游"],["souvenir","纪念品"]], answer: null },
        { type: "listen", prompt: "听完后选择你听到的句子", audio: "The museum is open from 9 AM to 6 PM.", options: ["The museum is open from 9 AM to 6 PM.", "The museum is open from 9 AM to 5 PM.", "The museum opens at 9 AM on weekdays.", "The museum is closed on Mondays."], answer: 0 },
      ]
    },
  ]
};

// ============ 课程生成器：每周生成 7 课 ============
function generateWeeklyLessons() {
  return WEEKLY_VOCAB.map((week, weekIdx) => {
    const unitId = "w" + (weekIdx + 1);
    const words = week.w;
    const sentences = week.s;

    // 每周 7 课
    const lessons = [
      {
        id: `${unitId}d1`, title: `第${weekIdx+1}周·词汇(一)`, xp: 15,
        questions: [
          ..._genChoice(words.slice(0, 6), 3),
          ..._genMatch(words.slice(0, 5), 5),
          ..._genChoiceReverse(words.slice(0, 6), 2),
        ]
      },
      {
        id: `${unitId}d2`, title: `第${weekIdx+1}周·词汇(二)`, xp: 15,
        questions: [
          ..._genChoice(words.slice(6, 12), 3),
          ..._genMatch(words.slice(6, 12), 5),
          ..._genChoiceReverse(words.slice(6, 12), 2),
        ]
      },
      {
        id: `${unitId}d3`, title: `第${weekIdx+1}周·语法填空`, xp: 20,
        questions: [
          ..._genFill(sentences, 3),
          ..._genChoice(words, 2),
          ..._genChoiceReverse(words, 2),
        ]
      },
      {
        id: `${unitId}d4`, title: `第${weekIdx+1}周·听力训练`, xp: 20,
        questions: [
          ..._genListen(words.slice(0, 6), 3),
          ..._genListen(words.slice(6, 12), 3),
          ..._genChoice(words, 1),
        ]
      },
      {
        id: `${unitId}d5`, title: `第${weekIdx+1}周·句子排序`, xp: 20,
        questions: [
          ..._genOrder(sentences, 3),
          ..._genMatch(words, 5),
          ..._genChoice(words, 2),
        ]
      },
      {
        id: `${unitId}d6`, title: `第${weekIdx+1}周·综合复习`, xp: 25,
        questions: [
          ..._genChoice(words, 2),
          ..._genListen(words, 2),
          ..._genMatch(words, 5),
          ..._genFill(sentences, 2),
        ]
      },
      {
        id: `${unitId}d7`, title: `第${weekIdx+1}周·周末测试`, xp: 30,
        questions: [
          ..._genChoice(words, 2),
          ..._genChoiceReverse(words, 2),
          ..._genListen(words, 2),
          ..._genOrder(sentences, 2),
        ]
      },
    ];

    return {
      id: unitId,
      title: week.t,
      icon: week.i,
      color: week.c,
      lessons: lessons
    };
  });
}

// ============ 原始手工单元 ============
const MANUAL_UNITS = [
  {
    id: "u1", title: "日常对话", icon: "💬", color: "#58cc02",
    lessons: [
      { id: "u1l1", title: "寒暄与闲聊", xp: 20, questions: [
        { type: "choice", prompt: "\"How's it going?\" 是什么意思？", options: ["最近怎么样？", "你要去哪里？", "几点了？", "多少钱？"], answer: 0 },
        { type: "fill", prompt: "I haven't seen you ___ ages!", options: ["for", "since", "in", "from"], answer: 0, hint: "for + 时间段" },
        { type: "choice", prompt: "别人说 \"Long time no see\"，你应该回答？", options: ["Yeah, it's been a while!", "See you later.", "Nice to meet you.", "No problem."], answer: 0 },
        { type: "listen", prompt: "听完后选择你听到的句子", audio: "What have you been up to?", options: ["What have you been up to?", "Where have you been going?", "What are you doing now?", "When are you coming back?"], answer: 0 },
        { type: "match", prompt: "将中英文配对", pairs: [["catch up","叙旧"],["run into","偶遇"],["hang out","闲逛"],["catch up later","回头再聊"]], answer: null },
      ]},
      { id: "u1l2", title: "问路与交通", xp: 20, questions: [
        { type: "fill", prompt: "Excuse me, could you tell me how to ___ to the station?", options: ["get", "arrive", "reach", "go to"], answer: 0, hint: "how to get to = 怎么去" },
        { type: "choice", prompt: "\"It's just around the corner\" 意思是？", options: ["就在拐角处", "在很远的地方", "在楼上", "已经关门了"], answer: 0 },
        { type: "listen", prompt: "听完后选择你听到的句子", audio: "Take the second turning on your left.", options: ["Take the second turning on your left.", "Take the second turning on your right.", "Take the first turning on your left.", "Turn left at the second traffic light."], answer: 0 },
        { type: "fill", prompt: "The museum is within walking ___.", options: ["distance", "time", "step", "way"], answer: 0 },
        { type: "match", prompt: "将中英文配对", pairs: [["subway","地铁"],["commute","通勤"],["fare","车费"],["transfer","换乘"]], answer: null },
      ]},
      { id: "u1l3", title: "餐厅与点餐", xp: 20, questions: [
        { type: "choice", prompt: "服务员问 \"Are you ready to order?\"，你想再等等，应该说？", options: ["Can we have a few more minutes?", "I don't want to eat.", "The food is cold.", "No, thank you."], answer: 0 },
        { type: "fill", prompt: "I'd like to ___ a reservation for two.", options: ["make", "do", "take", "have"], answer: 0 },
        { type: "choice", prompt: "\"Could we get the check, please?\" 意思是？", options: ["请结账", "请检查一下", "请上菜", "请买单（点餐）"], answer: 0 },
        { type: "match", prompt: "将中英文配对", pairs: [["appetizer","开胃菜"],["main course","主菜"],["dessert","甜点"],["tip","小费"]], answer: null },
        { type: "listen", prompt: "听完后选择你听到的句子", audio: "I'm allergic to seafood.", options: ["I'm allergic to seafood.", "I'd like some seafood.", "The seafood is fresh.", "Is there any seafood?"], answer: 0 },
      ]},
      { id: "u1l4", title: "购物与砍价", xp: 20, questions: [
        { type: "fill", prompt: "Is this on ___? I saw a discount sign.", options: ["sale", "sell", "selling", "sold"], answer: 0 },
        { type: "choice", prompt: "\"Can I try this on?\" 意思是？", options: ["我能试穿吗？", "我能买这个吗？", "这个有货吗？", "能便宜点吗？"], answer: 0 },
        { type: "choice", prompt: "你想问能不能退货，应该说？", options: ["What's your return policy?", "I want my money now.", "This is too expensive.", "Can I pay later?"], answer: 0 },
        { type: "match", prompt: "将中英文配对", pairs: [["refund","退款"],["receipt","收据"],["bargain","砍价"],["out of stock","缺货"]], answer: null },
        { type: "fill", prompt: "It's a ___ — buy one get one free!", options: ["deal", "seal", "meal", "real"], answer: 0 },
      ]},
    ]
  },
  {
    id: "u2", title: "语法专题", icon: "📝", color: "#1cb0f6",
    lessons: [
      { id: "u2l1", title: "现在完成时 vs 一般过去时", xp: 25, questions: [
        { type: "fill", prompt: "I ___ lived here since 2015.", options: ["have", "has", "had", "having"], answer: 0, hint: "since + 时间点 → 现在完成时" },
        { type: "fill", prompt: "Yesterday I ___ to the cinema with friends.", options: ["went", "have gone", "have been", "go"], answer: 0, hint: "有明确过去时间 → 一般过去时" },
        { type: "choice", prompt: "哪句是正确的？", options: ["I have already finished my homework.", "I already finish my homework.", "I have finish my homework already.", "I already finished have my homework."], answer: 0 },
        { type: "fill", prompt: "She ___ never been to Japan before.", options: ["has", "have", "is", "was"], answer: 0 },
        { type: "choice", prompt: "\"I have lost my keys\" 强调的是？", options: ["钥匙现在还没找到（影响现在）", "过去某个时间丢的（与现在无关）", "将来会丢钥匙", "从来没丢过钥匙"], answer: 0 },
        { type: "order", prompt: "将单词排成正确的句子", words: ["I", "have", "already", "seen", "that", "movie", "twice"], answer: "I have already seen that movie twice" },
      ]},
      { id: "u2l2", title: "条件句（虚拟语气）", xp: 25, questions: [
        { type: "fill", prompt: "If I ___ rich, I would travel the world.", options: ["were", "am", "will be", "was"], answer: 0, hint: "第二条件句" },
        { type: "fill", prompt: "If it rains tomorrow, we ___ stay at home.", options: ["will", "would", "shall", "would have"], answer: 0, hint: "第一条件句" },
        { type: "choice", prompt: "\"If I had studied harder, I would have passed.\" 描述的是？", options: ["过去未实现的事", "现在的事实", "将来的计划", "一般的建议"], answer: 0 },
        { type: "fill", prompt: "If I ___ you, I would apologize right now.", options: ["were", "am", "was", "be"], answer: 0, hint: "If I were you" },
        { type: "order", prompt: "将单词排成正确的句子", words: ["If", "I", "had", "time", "I", "would", "learn", "Spanish"], answer: "If I had time I would learn Spanish" },
      ]},
      { id: "u2l3", title: "被动语态", xp: 25, questions: [
        { type: "fill", prompt: "The letter ___ written by Shakespeare.", options: ["was", "is", "has", "did"], answer: 0, hint: "被动：be + 过去分词" },
        { type: "choice", prompt: "主动变被动：\"They built this bridge in 1990.\"", options: ["This bridge was built in 1990.", "This bridge is built in 1990.", "This bridge has built in 1990.", "This bridge built in 1990."], answer: 0 },
        { type: "fill", prompt: "English ___ spoken all over the world.", options: ["is", "are", "has", "does"], answer: 0 },
        { type: "choice", prompt: "哪句是正确的被动语态？", options: ["The car was repaired yesterday.", "The car repaired was yesterday.", "The car is repair yesterday.", "Yesterday the car repairing."], answer: 0 },
        { type: "order", prompt: "将单词排成正确的句子", words: ["The", "window", "was", "broken", "by", "the", "children"], answer: "The window was broken by the children" },
      ]},
      { id: "u2l4", title: "定语从句", xp: 25, questions: [
        { type: "fill", prompt: "The man ___ lives next door is a doctor.", options: ["who", "which", "what", "where"], answer: 0, hint: "先行词是人 → who" },
        { type: "fill", prompt: "This is the book ___ I told you about.", options: ["that", "who", "what", "where"], answer: 0, hint: "先行词是物 → that/which" },
        { type: "choice", prompt: "哪句是正确的？", options: ["The hotel where we stayed was great.", "The hotel which we stayed was great.", "The hotel who we stayed was great.", "The hotel what we stayed was great."], answer: 0 },
        { type: "fill", prompt: "My friend, ___ lives in Tokyo, is visiting me.", options: ["who", "which", "that", "where"], answer: 0 },
        { type: "match", prompt: "将关系代词与用法配对", pairs: [["who","指人（主语）"],["which","指物"],["whose","表所属"],["where","表地点"]], answer: null },
      ]},
    ]
  },
  {
    id: "u3", title: "商务英语", icon: "💼", color: "#ce82ff",
    lessons: [
      { id: "u3l1", title: "邮件与会议", xp: 25, questions: [
        { type: "fill", prompt: "I am writing to ___ a meeting for next Tuesday.", options: ["schedule", "plan", "do", "make"], answer: 0 },
        { type: "choice", prompt: "邮件中表达\"请查看附件\"，应该写？", options: ["Please find the attached file.", "Please look the attached.", "See the appendix below here.", "Attachment is please found."], answer: 0 },
        { type: "choice", prompt: "\"I look forward to hearing from you.\" 是邮件的？", options: ["结尾客套语", "开头问候", "正文要求", "邮件主题"], answer: 0 },
        { type: "fill", prompt: "Could you ___ me in the loop on this project?", options: ["keep", "put", "take", "let"], answer: 0, hint: "keep someone in the loop" },
        { type: "match", prompt: "将中英文配对", pairs: [["agenda","议程"],["minutes","会议纪要"],["deadline","截止日期"],["follow up","跟进"]], answer: null },
      ]},
      { id: "u3l2", title: "电话沟通", xp: 25, questions: [
        { type: "choice", prompt: "电话中想表达\"请稍等\"，应该说？", options: ["Could you hold on a moment?", "Wait a minute please.", "Stop calling now.", "I am busy now."], answer: 0 },
        { type: "fill", prompt: "I'm afraid he's not ___ at the moment.", options: ["available", "here", "exist", "in"], answer: 0 },
        { type: "choice", prompt: "\"I'll put you through.\" 意思是？", options: ["我帮你转接", "我帮你挂断", "你打错了", "线路故障"], answer: 0 },
        { type: "fill", prompt: "Could you speak up a bit? The line is ___.", options: ["bad", "good", "clear", "fine"], answer: 0 },
        { type: "match", prompt: "将中英文配对", pairs: [["extension","分机"],["voicemail","语音信箱"],["caller ID","来电显示"],["hang up","挂断"]], answer: null },
      ]},
      { id: "u3l3", title: "演讲与汇报", xp: 25, questions: [
        { type: "fill", prompt: "Let me start ___ giving you some background.", options: ["by", "with", "in", "for"], answer: 0 },
        { type: "choice", prompt: "演讲中想转到下一个话题，可以说？", options: ["Moving on to the next point...", "Stop here and change.", "Next is coming soon.", "I want to change topic."], answer: 0 },
        { type: "fill", prompt: "As you can see ___ the chart, sales have increased.", options: ["from", "in", "at", "on"], answer: 0, hint: "from the chart" },
        { type: "choice", prompt: "\"To sum up...\" 用在演讲的？", options: ["总结部分", "开场白", "中间过渡", "提问环节"], answer: 0 },
        { type: "order", prompt: "将单词排成正确的句子", words: ["I'd", "like", "to", "draw", "your", "attention", "to", "this", "chart"], answer: "I'd like to draw your attention to this chart" },
      ]},
    ]
  },
  {
    id: "u4", title: "词汇拓展", icon: "📚", color: "#ff9600",
    lessons: [
      { id: "u4l1", title: "高频动词短语", xp: 20, questions: [
        { type: "match", prompt: "将短语与意思配对", pairs: [["give up","放弃"],["look forward to","期待"],["put off","推迟"],["carry on","继续"]], answer: null },
        { type: "fill", prompt: "I can't ___ up with his constant complaints anymore.", options: ["put", "give", "look", "carry"], answer: 0, hint: "put up with = 忍受" },
        { type: "choice", prompt: "\"She turned down the job offer.\" 意思是？", options: ["她拒绝了这份工作", "她接受了这份工作", "她迟到了", "她辞职了"], answer: 0 },
        { type: "fill", prompt: "Please ___ out the form before the interview.", options: ["fill", "full", "feel", "fall"], answer: 0 },
        { type: "match", prompt: "将短语与意思配对", pairs: [["break down","抛锚/崩溃"],["figure out","弄明白"],["run out of","用完"],["call off","取消"]], answer: null },
      ]},
      { id: "u4l2", title: "常用搭配", xp: 20, questions: [
        { type: "fill", prompt: "She has a strong ___ of responsibility.", options: ["sense", "feeling", "idea", "thought"], answer: 0, hint: "a sense of" },
        { type: "fill", prompt: "I'd like to make an ___ with the dentist.", options: ["appointment", "agreement", "arrangement", "assignment"], answer: 0 },
        { type: "choice", prompt: "\"take it for granted\" 意思是？", options: ["认为理所当然", "免费获得", "表示感谢", "拒绝接受"], answer: 0 },
        { type: "fill", prompt: "He made a ___ decision under pressure.", options: ["tough", "strong", "hard", "difficult"], answer: 0, hint: "tough decision" },
        { type: "match", prompt: "将搭配与意思配对", pairs: [["heavy rain","大雨"],["strong wind","强风"],["high price","高价"],["deep breath","深呼吸"]], answer: null },
      ]},
      { id: "u4l3", title: "实用习语", xp: 20, questions: [
        { type: "choice", prompt: "\"It's raining cats and dogs\" 意思是？", options: ["下倾盆大雨", "有很多猫狗", "天气很冷", "发生混乱"], answer: 0 },
        { type: "choice", prompt: "\"Break a leg!\" 通常用在？", options: ["祝人好运（演出前）", "提醒小心", "描述受伤", "表达愤怒"], answer: 0 },
        { type: "fill", prompt: "Don't worry, it's a piece of ___.", options: ["cake", "bread", "pie", "cookie"], answer: 0, hint: "a piece of cake" },
        { type: "choice", prompt: "\"Let the cat out of the bag\" 意思是？", options: ["不小心泄露秘密", "放猫出去", "收拾行李", "取消计划"], answer: 0 },
        { type: "match", prompt: "将习语与意思配对", pairs: [["hit the books","用功读书"],["cost an arm and a leg","极其昂贵"],["under the weather","身体不适"],["once in a blue moon","极少发生"]], answer: null },
      ]},
    ]
  },
];

// ============ 单词深度数据库 ============
// 为高频单词提供音标、词性、例句、记忆法、搭配
const WORD_DB = {
  "alarm clock": { ipa:"/əˈlɑːm klɒk/", pos:"n.", ex:"I set my alarm clock for 6:30.", exZh:"我把闹钟设在6:30。", mnemonic:"alarm(警报)+clock(钟)→闹钟", collocations:["set an alarm","wind an alarm"] },
  "commute": { ipa:"/kəˈmjuːt/", pos:"v.", ex:"She commutes to London every day.", exZh:"她每天通勤去伦敦。", mnemonic:"com(共同)+mute(改变)→两地间改变位置→通勤", collocations:["commute to work","daily commute"] },
  "frustrated": { ipa:"/ˈfrʌstreɪtɪd/", pos:"adj.", ex:"He felt frustrated by the delay.", exZh:"他因延误感到沮丧。", mnemonic:"frustr(打破)+ate+ed→被打断计划的→沮丧的", collocations:["feel frustrated","frustrated with"] },
  "overwhelmed": { ipa:"/ˌoʊvərˈwelmd/", pos:"adj.", ex:"She was overwhelmed by the amount of work.", exZh:"她被工作量压垮了。", mnemonic:"over(过度)+whelm(压倒)→被压倒的→不知所措的", collocations:["overwhelmed by","overwhelmed with"] },
  "grateful": { ipa:"/ˈɡreɪtfəl/", pos:"adj.", ex:"I'm grateful for your help.", exZh:"我很感激你的帮助。", mnemonic:"grate(grace感恩)+ful→充满感恩的", collocations:["grateful for","grateful to"] },
  "anxious": { ipa:"/ˈæŋkʃəs/", pos:"adj.", ex:"She felt anxious about the exam.", exZh:"她对考试感到焦虑。", mnemonic:"anx(紧张)+ious→焦虑的", collocations:["anxious about","anxious to"] },
  "thrilled": { ipa:"/θrɪld/", pos:"adj.", ex:"I was thrilled to hear the news.", exZh:"听到消息我很兴奋。", mnemonic:"thrill(激动)+ed→兴奋的", collocations:["thrilled about","thrilled to"] },
  "nostalgic": { ipa:"/nɒˈstældʒɪk/", pos:"adj.", ex:"The song made me nostalgic.", exZh:"这首歌让我怀旧。", mnemonic:"nost(回家)+algia(痛)→想家之痛→怀旧的", collocations:["feel nostalgic","nostalgic for"] },
  "mortgage": { ipa:"/ˈmɔːrɡɪdʒ/", pos:"n.", ex:"They pay their mortgage every month.", exZh:"他们每月还房贷。", mnemonic:"mort(死)+gage(抵押)→到死才还清的抵押→房贷", collocations:["pay the mortgage","take out a mortgage"] },
  "renovate": { ipa:"/ˈrenəveɪt/", pos:"v.", ex:"We plan to renovate the kitchen.", exZh:"我们计划翻新厨房。", mnemonic:"re(重新)+nov(新)+ate→翻新", collocations:["renovate a house","fully renovated"] },
  "synergy": { ipa:"/ˈsɪnərdʒi/", pos:"n.", ex:"The synergy between the teams was impressive.", exZh:"团队间的协同效应令人印象深刻。", mnemonic:"syn(共同)+ergy(能量)→共同能量→协同", collocations:["create synergy","synergy between"] },
  "consensus": { ipa:"/kənˈsensəs/", pos:"n.", ex:"We reached a consensus on the plan.", exZh:"我们就计划达成共识。", mnemonic:"con(共同)+sens(感觉)→共同感觉→共识", collocations:["reach consensus","build consensus"] },
  "resilience": { ipa:"/rɪˈzɪliəns/", pos:"n.", ex:"Her resilience helped her overcome challenges.", exZh:"她的韧性帮助她克服挑战。", mnemonic:"re(回)+sili(跳)→弹回→韧性", collocations:["build resilience","emotional resilience"] },
  "compromise": { ipa:"/ˈkɒmprəmaɪz/", pos:"n./v.", ex:"Both sides had to compromise.", exZh:"双方都需要妥协。", mnemonic:"com(共同)+promise(承诺)→共同承诺→妥协", collocations:["reach a compromise","compromise on"] },
  "appointment": { ipa:"/əˈpɔɪntmənt/", pos:"n.", ex:"I have an appointment with Dr. Smith.", exZh:"我和史密斯医生有预约。", mnemonic:"ap(去)+point(指向)+ment→被指向→指定时间→预约", collocations:["make an appointment","schedule an appointment"] },
  "prescription": { ipa:"/prɪˈskrɪpʃən/", pos:"n.", ex:"You need a prescription for this medicine.", exZh:"这药需要处方。", mnemonic:"pre(预先)+script(写)+ion→预先写好的→处方", collocations:["write a prescription","fill a prescription"] },
  "sustainability": { ipa:"/səˌsteɪnəˈbɪlɪti/", pos:"n.", ex:"Sustainability is crucial for our future.", exZh:"可持续性对我们的未来至关重要。", mnemonic:"sustain(维持)+ability→维持能力→可持续性", collocations:["environmental sustainability","promote sustainability"] },
  "persuade": { ipa:"/pərˈsweɪd/", pos:"v.", ex:"She persuaded me to join the team.", exZh:"她说服我加入团队。", mnemonic:"pers(通过)+suade(劝)→通过劝说→说服", collocations:["persuade someone to","persuade into"] },
  "negotiate": { ipa:"/nɪˈɡoʊʃieɪt/", pos:"v.", ex:"We need to negotiate a better deal.", exZh:"我们需要谈判争取更好的协议。", mnemonic:"neg(否定)+otium(休闲)→不是休闲→忙于事务→谈判", collocations:["negotiate with","negotiate a deal"] },
  "diversify": { ipa:"/daɪˈvɜːrsɪfaɪ/", pos:"v.", ex:"Don't put all eggs in one basket—diversify!", exZh:"不要把鸡蛋放一个篮子里——要分散投资！", mnemonic:"di(分开)+vers(转)+ify→转向不同方向→分散", collocations:["diversify investments","diversify into"] },
};

// 动态获取单词详情（没有 curated 数据时自动生成基础信息）
function getWordDetail(word) {
  if (WORD_DB[word]) return WORD_DB[word];
  // 基础推断
  let pos = "v.";
  if (word.endsWith("tion") || word.endsWith("ment") || word.endsWith("ness") || word.endsWith("ity")) pos = "n.";
  else if (word.endsWith("ful") || word.endsWith("ous") || word.endsWith("ive") || word.endsWith("able")) pos = "adj.";
  else if (word.endsWith("ly")) pos = "adv.";
  return { ipa: null, pos, ex: null, exZh: null, mnemonic: null, collocations: [] };
}

// ============ 语法知识点库 ============
const GRAMMAR_POINTS = {
  "日常作息": {
    title: "一般现在时 — 表日常习惯",
    rule: "主语 + 动词原形（第三人称单数加 -s/-es）",
    explanation: "一般现在时用于描述经常性、习惯性的动作。当主语是 he/she/it 时，动词需加 -s/-es。",
    examples: [
      { en: "I brush my teeth twice a day.", zh: "我每天刷牙两次。", note: "I 用原形 brush" },
      { en: "She commutes to work by subway.", zh: "她坐地铁通勤。", note: "she 加 -s: commute→commutes" },
    ],
    commonErrors: "❌ He brush teeth → ✓ He brushes his teeth（漏加 -es 和物主代词 his）",
  },
  "家庭关系": {
    title: "名词的数与冠词",
    rule: "可数名词有单复数；不可数名词不加 a/an",
    explanation: "表示家庭成员的可数名词，复数加 -s。注意 in-laws（姻亲）本身是复数形式。",
    examples: [
      { en: "My siblings live in different cities.", zh: "我的兄弟姐妹住在不同城市。", note: "sibling→siblings" },
      { en: "She is an only child.", zh: "她是独生女。", note: "用 an 不用 a（only 以元音开头）" },
    ],
    commonErrors: "❌ She is a only child → ✓ She is an only child（元音前用 an）",
  },
  "个人爱好": {
    title: "动名词作宾语 — enjoy + V-ing",
    rule: "enjoy/finish/practice/mind + doing sth.",
    explanation: "某些动词后接动名词（V-ing）作宾语，不能接不定式。",
    examples: [
      { en: "I enjoy photography in my free time.", zh: "我空闲时间喜欢摄影。", note: "enjoy + n." },
      { en: "She has been collecting stamps since childhood.", zh: "她从小就集邮。", note: "has been + V-ing 现在完成进行时" },
    ],
    commonErrors: "❌ I enjoy to read → ✓ I enjoy reading（enjoy 后接 doing 不接 to do）",
  },
  "友谊社交": {
    title: "短语动词 — 动词 + 介词/副词",
    rule: "keep in touch / drift apart / break the ice",
    explanation: "短语动词的意思不等于动词和介词的简单相加。需要注意搭配和语境。",
    examples: [
      { en: "We try to keep in touch with old friends.", zh: "我们努力和老朋友保持联系。", note: "keep in touch with + 人" },
      { en: "It takes time to break the ice at parties.", zh: "在派对上破冰需要时间。", note: "break the ice = 打破僵局" },
    ],
    commonErrors: "❌ keep on touch → ✓ keep in touch（介词用 in 不是 on）",
  },
  "情感表达": {
    title: "形容词 + 介词搭配",
    rule: "frustrated with / grateful for / anxious about",
    explanation: "表示情感的形容词后常接固定介词，需要整体记忆。",
    examples: [
      { en: "I feel grateful for all your help.", zh: "我很感激你的所有帮助。", note: "grateful + for" },
      { en: "She was anxious about the exam results.", zh: "她对考试结果感到焦虑。", note: "anxious + about" },
    ],
    commonErrors: "❌ grateful about your help → ✓ grateful for your help（用 for 不是 about）",
  },
  "求职面试": {
    title: "情态动词 — 表建议与请求",
    rule: "should / would / could + 动词原形",
    explanation: "面试中用 could/would 表委婉请求，用 should 表建议。",
    examples: [
      { en: "You should update your resume before applying.", zh: "你申请前应该更新简历。", note: "should + do" },
      { en: "Could you tell me about the team culture?", zh: "您能介绍一下团队文化吗？", note: "could 表委婉请求" },
    ],
    commonErrors: "❌ Could you telling me → ✓ Could you tell me（could + 动词原形）",
  },
  "办公室英语": {
    title: "被动语态在商务中的运用",
    rule: "be + 过去分词 (is done / was done)",
    explanation: "商务中常用被动语态使语气更正式、客观。",
    examples: [
      { en: "The meeting has been rescheduled.", zh: "会议已重新安排。", note: "has been + 过去分词" },
      { en: "All action items must be completed by Friday.", zh: "所有待办事项须在周五前完成。", note: "must be + 过去分词" },
    ],
    commonErrors: "❌ The meeting has reschedule → ✓ The meeting has been rescheduled（被动需加 been）",
  },
  "学术写作": {
    title: "正式写作 — 避免缩写与口语",
    rule: "不用 don't/can't，用 do not/cannot",
    explanation: "学术写作要求正式，避免缩写、口语化表达，使用客观语气。",
    examples: [
      { en: "The research does not support this hypothesis.", zh: "研究不支持此假设。", note: "不用 doesn't" },
      { en: "This study aims to investigate the effect.", zh: "本研究旨在调查此影响。", note: "aim to + V" },
    ],
    commonErrors: "❌ This paper doesn't show → ✓ This paper does not show（学术写作不用缩写）",
  },
  "机场海关": {
    title: "祈使句与情态动词 — 旅行指令",
    rule: "Please + 动词原形 / You need to + V",
    explanation: "机场中常见祈使句表指令，情态动词表要求。",
    examples: [
      { en: "Please proceed to gate B12 for boarding.", zh: "请前往B12登机口登机。", note: "Please + V" },
      { en: "You need to show your passport at security.", zh: "安检时需要出示护照。", note: "need to + V" },
    ],
    commonErrors: "❌ Please proceeding to gate → ✓ Please proceed to gate（Please 后接原形）",
  },
  "餐厅用语": {
    title: "礼貌请求 — I'd like to / Could I have",
    rule: "I'd like to + V / Could I have + n.?",
    explanation: "餐厅中用 I'd like to（我想要）和 Could I have（我能要…吗）表礼貌。",
    examples: [
      { en: "I'd like to order the grilled salmon.", zh: "我想点烤三文鱼。", note: "I'd like to + V" },
      { en: "Could we have the bill, please?", zh: "请结账。", note: "Could + 主语 + have" },
    ],
    commonErrors: "❌ I want the bill → ✓ I'd like the bill, please（更礼貌）",
  },
};

// 获取语法知识点（按周主题）
function getGrammarForTheme(themeName) {
  return GRAMMAR_POINTS[themeName] || null;
}

// ============ 口语练习场景 ============
const SPEAKING_PRACTICE = [
  {
    id: "sp_airport",
    title: "机场值机",
    icon: "✈️",
    color: "#ff4b4b",
    difficulty: "初级",
    scenario: "你在机场值机柜台，需要办理登机手续并询问登机口信息",
    dialogues: [
      { speaker: "Agent", text: "Good morning! May I see your passport and ticket?", translation: "早上好！请出示您的护照和机票。", isUser: false },
      { speaker: "You", text: "Here you go. I'd like to check in for my flight to Tokyo.", translation: "给您。我要办理飞东京的航班值机。", isUser: true },
      { speaker: "Agent", text: "Window or aisle seat?", translation: "靠窗还是靠走道的座位？", isUser: false },
      { speaker: "You", text: "A window seat, please. Could you tell me the gate number?", translation: "请给我靠窗的座位。能告诉我登机口号码吗？", isUser: true },
      { speaker: "Agent", text: "Your gate is B12. Boarding starts at 3:30 PM.", translation: "您的登机口是B12，下午3:30开始登机。", isUser: false },
      { speaker: "You", text: "Thank you. Where is the security check?", translation: "谢谢。安检在哪里？", isUser: true },
      { speaker: "Agent", text: "Go straight and turn right after the duty-free shop.", translation: "直走，过了免税店右转。", isUser: false },
    ],
    keyPhrases: [
      { phrase: "May I see...?", meaning: "请出示…（礼貌请求）", pattern: "May I see + 名词?" },
      { phrase: "I'd like to check in", meaning: "我要办理值机", pattern: "I'd like to + 动词" },
      { phrase: "Window or aisle?", meaning: "靠窗还是靠走道", pattern: "A or B?" },
      { phrase: "Could you tell me...?", meaning: "您能告诉我…吗？", pattern: "Could you tell me + 从句?" },
    ],
  },
  {
    id: "sp_hotel",
    title: "酒店入住",
    icon: "🏨",
    color: "#1cb0f6",
    difficulty: "初级",
    scenario: "你到达酒店前台，需要办理入住并询问设施",
    dialogues: [
      { speaker: "You", text: "Good evening. I have a reservation under the name Li Ming.", translation: "晚上好。我用李明的名字预订了房间。", isUser: true },
      { speaker: "Clerk", text: "Welcome! Let me check. Yes, a double room for three nights?", translation: "欢迎！让我查一下。是的，双人间住三晚？", isUser: false },
      { speaker: "You", text: "That's right. Could I have a room on a higher floor?", translation: "对的。能给我高楼层的房间吗？", isUser: true },
      { speaker: "Clerk", text: "Sure. Your room number is 805. Here's your key card.", translation: "没问题。您的房间号是805。这是您的房卡。", isUser: false },
      { speaker: "You", text: "Thank you. What time is breakfast served?", translation: "谢谢。早餐几点供应？", isUser: true },
      { speaker: "Clerk", text: "Breakfast is from 7 to 10 AM in the restaurant on the first floor.", translation: "早7点到10点在一楼餐厅。", isUser: false },
      { speaker: "You", text: "Great. Is there a gym in the hotel?", translation: "好的。酒店有健身房吗？", isUser: true },
      { speaker: "Clerk", text: "Yes, the gym is on the third floor, open 24 hours.", translation: "有的，在三层，24小时开放。", isUser: false },
    ],
    keyPhrases: [
      { phrase: "I have a reservation under...", meaning: "我用…名字预订了", pattern: "under the name + 名字" },
      { phrase: "Could I have...?", meaning: "能给我…吗？", pattern: "Could I have + 名词?" },
      { phrase: "What time is...?", meaning: "几点…？", pattern: "What time is + 主语?" },
      { phrase: "Is there a...?", meaning: "有…吗？", pattern: "Is there a + 名词?" },
    ],
  },
  {
    id: "sp_restaurant",
    title: "餐厅点餐",
    icon: "🍽️",
    color: "#ce82ff",
    difficulty: "中级",
    scenario: "你在餐厅用餐，需要点餐、询问推荐并结账",
    dialogues: [
      { speaker: "Waiter", text: "Good evening! Are you ready to order?", translation: "晚上好！您准备好点餐了吗？", isUser: false },
      { speaker: "You", text: "Not yet. Could you recommend the chef's special?", translation: "还没有。能推荐主厨特色菜吗？", isUser: true },
      { speaker: "Waiter", text: "Today's special is grilled salmon with seasonal vegetables.", translation: "今天的特色是烤三文鱼配时蔬。", isUser: false },
      { speaker: "You", text: "That sounds great. I'll have that, please.", translation: "听起来不错。我就要这个。", isUser: true },
      { speaker: "Waiter", text: "How would you like your steak cooked, if you order one?", translation: "如果您点牛排，要几分熟？", isUser: false },
      { speaker: "You", text: "Medium rare, please. Also, I'm allergic to seafood.", translation: "五分熟。另外我对海鲜过敏。", isUser: true },
      { speaker: "Waiter", text: "No problem. I'll let the chef know.", translation: "没问题。我会告知厨师。", isUser: false },
      { speaker: "You", text: "Thank you. Could we have the bill, please?", translation: "谢谢。请结账。", isUser: true },
    ],
    keyPhrases: [
      { phrase: "Are you ready to order?", meaning: "您准备好点餐了吗？", pattern: "ready to + V" },
      { phrase: "Could you recommend...?", meaning: "能推荐…吗？", pattern: "Could you + V?" },
      { phrase: "How would you like...?", meaning: "您想要…什么样的？", pattern: "How would you like + n.?" },
      { phrase: "I'm allergic to...", meaning: "我对…过敏", pattern: "allergic to + n." },
    ],
  },
  {
    id: "sp_shopping",
    title: "购物砍价",
    icon: "🛒",
    color: "#ff9600",
    difficulty: "中级",
    scenario: "你在商场购物，需要询问价格、试穿和砍价",
    dialogues: [
      { speaker: "You", text: "Excuse me, how much is this jacket?", translation: "打扰一下，这件外套多少钱？", isUser: true },
      { speaker: "Staff", text: "It's 120 dollars. Would you like to try it on?", translation: "120美元。您要试穿吗？", isUser: false },
      { speaker: "You", text: "Yes, please. Do you have it in a larger size?", translation: "好的。有大一码的吗？", isUser: true },
      { speaker: "Staff", text: "Let me check. Yes, here's a size L.", translation: "我查一下。有的，这是L码。", isUser: false },
      { speaker: "You", text: "Can I try it on in the fitting room?", translation: "我能在试衣间试穿吗？", isUser: true },
      { speaker: "Staff", text: "Of course. The fitting room is right over there.", translation: "当然。试衣间就在那边。", isUser: false },
      { speaker: "You", text: "It fits well! Could you give me a discount?", translation: "很合身！能便宜点吗？", isUser: true },
      { speaker: "Staff", text: "I can offer you 10% off. It's a great deal!", translation: "可以打九折。很划算了！", isUser: false },
    ],
    keyPhrases: [
      { phrase: "How much is...?", meaning: "多少钱？", pattern: "How much is + n.?" },
      { phrase: "Do you have it in...?", meaning: "有…的吗？", pattern: "in + 尺寸/颜色" },
      { phrase: "Can I try it on?", meaning: "能试穿吗？", pattern: "try on + n." },
      { phrase: "Could you give me a discount?", meaning: "能打折吗？", pattern: "give + 人 + a discount" },
    ],
  },
  {
    id: "sp_directions",
    title: "问路指路",
    icon: "🗺️",
    color: "#58cc02",
    difficulty: "初级",
    scenario: "你在国外街头需要问路，找到地铁站",
    dialogues: [
      { speaker: "You", text: "Excuse me, could you help me? I'm looking for the nearest subway station.", translation: "打扰一下，能帮帮我吗？我在找最近的地铁站。", isUser: true },
      { speaker: "Local", text: "Sure! Go straight ahead for two blocks, then turn left.", translation: "当然！直走两个街区，然后左转。", isUser: false },
      { speaker: "You", text: "Turn left after two blocks. Is it far from here?", translation: "两个街区后左转。离这里远吗？", isUser: true },
      { speaker: "Local", text: "No, it's about a five-minute walk. It's just across the street.", translation: "不远，步行五分钟。就在对面。", isUser: false },
      { speaker: "You", text: "Is there a landmark I should look for?", translation: "有什么地标可以找吗？", isUser: true },
      { speaker: "Local", text: "Yes, you'll see a big blue sign that says 'Metro'.", translation: "有的，你会看到写着Metro的蓝色大标志。", isUser: false },
      { speaker: "You", text: "Got it. Thank you so much for your help!", translation: "明白了。非常感谢你的帮助！", isUser: true },
      { speaker: "Local", text: "You're welcome! Have a great day!", translation: "不客气！祝你有美好的一天！", isUser: false },
    ],
    keyPhrases: [
      { phrase: "I'm looking for...", meaning: "我在找…", pattern: "look for + n." },
      { phrase: "Go straight ahead", meaning: "直走", pattern: "straight + ahead" },
      { phrase: "Is it far from here?", meaning: "离这远吗？", pattern: "far from + 地点" },
      { phrase: "across the street", meaning: "马路对面", pattern: "across + n." },
    ],
  },
  {
    id: "sp_doctor",
    title: "就医问诊",
    icon: "💊",
    color: "#ff4b4b",
    difficulty: "高级",
    scenario: "你在国外感到不适，需要看医生描述症状",
    dialogues: [
      { speaker: "Doctor", text: "Hello, what seems to be the problem today?", translation: "你好，今天哪里不舒服？", isUser: false },
      { speaker: "You", text: "I've had a sore throat and a fever since yesterday.", translation: "从昨天开始喉咙痛还发烧。", isUser: true },
      { speaker: "Doctor", text: "Let me take a look. Open your mouth, please.", translation: "我看看。请张开嘴。", isUser: false },
      { speaker: "You", text: "Is it anything serious? I also feel a bit dizzy.", translation: "严重吗？我还觉得有点头晕。", isUser: true },
      { speaker: "Doctor", text: "It looks like a common cold. I'll prescribe some medicine.", translation: "看起来是普通感冒。我给你开些药。", isUser: false },
      { speaker: "You", text: "Do I need to take any precautions? Any side effects?", translation: "需要注意什么吗？有副作用吗？", isUser: true },
      { speaker: "Doctor", text: "Take it twice a day after meals. It may cause drowsiness.", translation: "每天两次，饭后服用。可能引起嗜睡。", isUser: false },
      { speaker: "You", text: "Thank you, doctor. How long until I recover?", translation: "谢谢医生。多久能好？", isUser: true },
    ],
    keyPhrases: [
      { phrase: "What seems to be the problem?", meaning: "哪里不舒服？", pattern: "What seems to be + n.?" },
      { phrase: "I've had... since...", meaning: "从…开始我就…", pattern: "have had + 症状 + since + 时间" },
      { phrase: "Is it anything serious?", meaning: "严重吗？", pattern: "Is it + anything + adj.?" },
      { phrase: "twice a day after meals", meaning: "每天两次饭后", pattern: "次数 + a day" },
    ],
  },
];

// ============ 最终导出：合并所有单元 ============
const COURSE_DATA = [
  TRAVEL_UNIT,
  ...MANUAL_UNITS,
  ...generateWeeklyLessons(),
];
