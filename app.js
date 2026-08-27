/**
 * 英语学习工作台 — 应用逻辑 v2
 * 新增功能：日历打卡 / 实时保存 / 每日提醒 / 断点续学 / 今日推荐
 */

// ============ 状态管理 ============
const STORAGE_KEY = "eng_learn_state_v3";

const defaultState = {
  xp: 0,
  gems: 5,
  streak: 0,
  bestStreak: 0,
  lastPracticeDate: null,
  checkins: {},          // { "2026-08-26": { lessons: 2, xp: 40, titles: [...] } }
  completedLessons: [],  // [lessonId, ...]
  dailyGoal: 2,
  dailyCompleted: 0,
  dailyDate: null,
  reminderEnabled: false,
  reminderTime: "20:00",
  // 断点续学
  resumeLesson: null,     // { unitId, lessonId, questionIndex, hearts, correctCount }
  // 错题本 + 间隔重复
  errorBook: {},          // { word: { count, lastWrong, mastery, nextReview, zh } }
  // 口语练习成绩
  speakingScores: {},     // { scenarioId: { bestScore, attempts, lastScore } }
  // 学习统计
  totalCorrect: 0,
  totalWrong: 0,
};

let state = loadState();
let lessonState = null;

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return Object.assign({}, defaultState, JSON.parse(saved));
  } catch (e) {}
  return Object.assign({}, defaultState);
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
}

// 实时保存（每次答题后调用）
function saveRealtime() {
  if (lessonState) {
    state.resumeLesson = {
      unitId: lessonState.currentUnit.id,
      lessonId: lessonState.currentLesson.id,
      questionIndex: lessonState.questionIndex,
      hearts: lessonState.hearts,
      correctCount: lessonState.correctCount,
    };
  }
  saveState();
}

// 日期工具
function dateKey(d) {
  const dt = d || new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function checkStreak() {
  const today = dateKey();
  if (state.dailyDate !== today) {
    if (state.lastPracticeDate) {
      const last = state.lastPracticeDate;
      const lastDate = new Date(last);
      const yesterday = new Date(Date.now() - 86400000);
      if (dateKey(lastDate) !== dateKey(yesterday) && dateKey(lastDate) !== today) {
        state.streak = 0;
      }
    }
    state.dailyCompleted = 0;
    state.dailyDate = today;
    saveState();
  }
}

// ============ 练习引擎状态 ============
function initLessonState(unit, lesson) {
  return {
    currentUnit: unit,
    currentLesson: lesson,
    questionIndex: 0,
    hearts: 3,
    correctCount: 0,
    totalQuestions: lesson.questions.length,
    answered: false,
    selectedAnswer: null,
    earnedXP: 0,
    matchSelected: null,
    matchPairs: [],
    orderWords: [],
    orderPlaced: [],
  };
}

// ============ DOM 工具 ============
const $ = (id) => document.getElementById(id);

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(screenId).classList.add("active");
  // 底部导航显示控制
  const showNav = screenId === "home-screen" || screenId === "calendar-screen" 
    || screenId === "error-screen" || screenId === "speaking-list-screen";
  $("bottom-nav").style.display = showNav ? "flex" : "none";
  // 导航高亮
  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.screen === screenId);
  });
  // 隐藏单词注释和语法面板（非课程页）
  if (screenId !== "lesson-screen") {
    const ann = $("word-annotation"); if (ann) ann.style.display = "none";
    const gp = $("grammar-panel"); if (gp) gp.style.display = "none";
  }
}

// ============ 首页渲染 ============
function renderHome() {
  checkStreak();

  $("streak-value").textContent = state.streak;
  $("xp-value").textContent = state.xp;
  $("gems-value").textContent = state.gems;

  // 每日进度
  const goalPct = Math.min(100, (state.dailyCompleted / state.dailyGoal) * 100);
  $("daily-fill").style.width = goalPct + "%";
  const todayKey = dateKey();
  const todayCheckin = state.checkins[todayKey];
  if (state.dailyCompleted >= state.dailyGoal) {
    $("daily-goal-text").textContent = "🎉 今日目标已达成！";
  } else {
    $("daily-goal-text").textContent =
      `每日目标：完成 ${state.dailyGoal} 课（已完成 ${state.dailyCompleted}）`;
  }

  // 提醒横幅
  if (state.dailyCompleted === 0) {
    $("reminder-banner").style.display = "flex";
    $("reminder-text").textContent = "今天还没学习哦，坚持打卡保持连胜！";
  } else if (state.dailyCompleted < state.dailyGoal) {
    $("reminder-banner").style.display = "flex";
    $("reminder-text").textContent = `已完成 ${state.dailyCompleted}/${state.dailyGoal} 课，加油！`;
  } else {
    $("reminder-banner").style.display = "none";
  }

  // 提醒设置
  $("reminder-toggle").checked = state.reminderEnabled;
  $("reminder-time").value = state.reminderTime || "20:00";

  // 底部统计
  const totalLessons = COURSE_DATA.reduce((s, u) => s + u.lessons.length, 0);
  $("footer-stats").textContent =
    `📊 共 ${COURSE_DATA.length} 个单元 · ${totalLessons} 课 · 已完成 ${state.completedLessons.length} 课`;

  // 今日推荐（找到下一个未完成的课程）
  renderTodayRecommend();

  // 课程列表
  renderCourseList();
}

function renderTodayRecommend() {
  const list = $("today-recommend-list");
  list.innerHTML = "";
  let recommended = [];

  // 优先推荐旅游英语和手工单元的未完成课程
  for (let i = 0; i < Math.min(5, COURSE_DATA.length); i++) {
    const unit = COURSE_DATA[i];
    for (const lesson of unit.lessons) {
      if (!state.completedLessons.includes(lesson.id)) {
        recommended.push({ unit, lesson });
        if (recommended.length >= 3) break;
      }
    }
    if (recommended.length >= 3) break;
  }

  // 如果前面都完成了，推荐每周课程
  if (recommended.length < 3) {
    for (const unit of COURSE_DATA) {
      for (const lesson of unit.lessons) {
        if (!state.completedLessons.includes(lesson.id)) {
          if (!recommended.find(r => r.lesson.id === lesson.id)) {
            recommended.push({ unit, lesson });
            if (recommended.length >= 3) break;
          }
        }
      }
      if (recommended.length >= 3) break;
    }
  }

  recommended.forEach(({ unit, lesson }) => {
    const card = document.createElement("div");
    card.className = "today-card";
    card.style.borderColor = unit.color;
    card.innerHTML = `
      <div class="today-card-icon">${unit.icon}</div>
      <div class="today-card-title">${lesson.title}</div>
      <div class="today-card-meta">${lesson.questions.length} 题 · +${lesson.xp} XP</div>
    `;
    card.addEventListener("click", () => startLesson(unit, lesson));
    list.appendChild(card);
  });
}

function renderCourseList() {
  const list = $("course-list");
  list.innerHTML = "";

  // 只显示前几个单元 + 周课程的分组
  // 手工单元（旅游 + 日常 + 语法 + 商务 + 词汇）
  const manualUnits = COURSE_DATA.filter(u => !u.id.startsWith("w"));
  // 周课程
  const weeklyUnits = COURSE_DATA.filter(u => u.id.startsWith("w"));

  // 先渲染手工单元
  manualUnits.forEach((unit) => {
    list.appendChild(createUnitBlock(unit));
  });

  // 周课程按月分组（每4周=1月）
  const monthDiv = document.createElement("div");
  monthDiv.className = "unit-block";
  const monthHeader = document.createElement("div");
  monthHeader.className = "unit-header";
  monthHeader.innerHTML = `<span class="unit-icon" style="background:#8c8c8c">📅</span><span>52周系统课程（共${weeklyUnits.length}周）</span>`;
  monthDiv.appendChild(monthHeader);

  weeklyUnits.slice(0, 8).forEach((unit) => {
    monthDiv.appendChild(createUnitBlockInline(unit));
  });

  // 折叠提示
  if (weeklyUnits.length > 8) {
    const more = document.createElement("div");
    more.style.cssText = "text-align:center;padding:12px;color:var(--text-muted);font-size:13px;";
    more.textContent = `▼ 还有 ${weeklyUnits.length - 8} 周课程，完成前面的自动解锁`;
    monthDiv.appendChild(more);
  }

  list.appendChild(monthDiv);
}

function createUnitBlock(unit) {
  const unitDiv = document.createElement("div");
  unitDiv.className = "unit-block";

  const header = document.createElement("div");
  header.className = "unit-header";
  header.innerHTML = `
    <span class="unit-icon" style="background:${unit.color}">${unit.icon}</span>
    <span>${unit.title}</span>
  `;
  unitDiv.appendChild(header);

  unit.lessons.forEach((lesson, lessonIdx) => {
    unitDiv.appendChild(createLessonNode(unit, lesson, lessonIdx));
  });

  return unitDiv;
}

function createUnitBlockInline(unit) {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:flex;flex-direction:column;gap:8px;margin-bottom:8px;";

  const header = document.createElement("div");
  header.className = "unit-header";
  header.style.cssText = "font-size:13px;padding:2px 0;";
  header.innerHTML = `<span class="unit-icon" style="background:${unit.color};width:24px;height:24px;font-size:14px;">${unit.icon}</span><span>${unit.title}</span>`;
  wrapper.appendChild(header);

  // 只显示第一课作为入口
  const lesson = unit.lessons[0];
  const node = createLessonNode(unit, lesson, 0);
  wrapper.appendChild(node);
  return wrapper;
}

function createLessonNode(unit, lesson, lessonIdx) {
  const isCompleted = state.completedLessons.includes(lesson.id);
  let isUnlocked;
  if (lessonIdx === 0) {
    isUnlocked = true;
  } else {
    const prevLessonId = unit.lessons[lessonIdx - 1].id;
    isUnlocked = state.completedLessons.includes(prevLessonId);
  }

  const node = document.createElement("div");
  node.className = `lesson-node ${isCompleted ? "completed" : ""} ${isUnlocked ? "unlocked" : "locked"}`;
  node.innerHTML = `
    <div class="lesson-node-icon">${isCompleted ? "✓" : isUnlocked ? "📘" : "🔒"}</div>
    <div class="lesson-node-info">
      <div class="lesson-node-title">${lesson.title}</div>
      <div class="lesson-node-meta">${lesson.questions.length} 题 · +${lesson.xp} XP</div>
    </div>
    <span class="lesson-node-arrow">${isUnlocked ? "›" : ""}</span>
  `;

  if (isUnlocked) {
    node.addEventListener("click", () => startLesson(unit, lesson));
  }

  return node;
}

// ============ 开始课程 ============
function startLesson(unit, lesson) {
  lessonState = initLessonState(unit, lesson);
  $("lesson-hearts-value").textContent = lessonState.hearts;
  $("feedback-bar").className = "feedback-bar";
  $("btn-check").textContent = "检查";
  $("btn-check").disabled = true;
  showScreen("lesson-screen");
  renderQuestion();
}

// 断点续学
function resumeLesson() {
  if (!state.resumeLesson) return false;
  const r = state.resumeLesson;
  // 找到对应的单元和课程
  let unit = null, lesson = null;
  for (const u of COURSE_DATA) {
    if (u.id === r.unitId) {
      unit = u;
      lesson = u.lessons.find(l => l.id === r.lessonId);
      break;
    }
  }
  if (!unit || !lesson) {
    state.resumeLesson = null;
    saveState();
    return false;
  }

  lessonState = initLessonState(unit, lesson);
  lessonState.questionIndex = r.questionIndex;
  lessonState.hearts = r.hearts;
  lessonState.correctCount = r.correctCount;

  $("lesson-hearts-value").textContent = lessonState.hearts;
  $("feedback-bar").className = "feedback-bar";
  $("btn-check").textContent = "检查";
  $("btn-check").disabled = true;
  showScreen("lesson-screen");
  renderQuestion();
  return true;
}

// ============ 渲染题目 ============
function renderQuestion() {
  const q = lessonState.currentLesson.questions[lessonState.questionIndex];
  const area = $("question-area");
  area.innerHTML = "";

  const pct = (lessonState.questionIndex / lessonState.totalQuestions) * 100;
  $("lesson-progress-fill").style.width = pct + "%";

  lessonState.answered = false;
  lessonState.selectedAnswer = null;
  $("feedback-bar").className = "feedback-bar";
  $("btn-check").textContent = "检查";
  $("btn-check").disabled = true;
  $("btn-check").className = "btn-check";
  
  // 隐藏单词注释和语法面板
  const ann = $("word-annotation"); if (ann) ann.style.display = "none";
  const gp = $("grammar-panel"); if (gp) gp.style.display = "none";

  switch (q.type) {
    case "choice": renderChoice(area, q); break;
    case "fill":   renderChoice(area, q); break;
    case "listen": renderListen(area, q); break;
    case "match":  renderMatch(area, q); break;
    case "order":  renderOrder(area, q); break;
  }
}

// ---- 选择题 / 填空题 ----
function renderChoice(area, q) {
  const prompt = document.createElement("div");
  prompt.className = "question-prompt";
  prompt.textContent = q.prompt;
  area.appendChild(prompt);

  if (q.hint) {
    const hint = document.createElement("div");
    hint.className = "question-hint";
    hint.textContent = "💡 " + q.hint;
    area.appendChild(hint);
  }

  const list = document.createElement("div");
  list.className = "option-list";
  const letters = ["A", "B", "C", "D", "E"];

  q.options.forEach((opt, i) => {
    const card = document.createElement("div");
    card.className = "option-card";
    card.innerHTML = `<span class="option-letter">${letters[i]}</span><span class="option-text">${opt}</span>`;
    card.addEventListener("click", () => {
      if (lessonState.answered) return;
      list.querySelectorAll(".option-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      lessonState.selectedAnswer = i;
      $("btn-check").disabled = false;
    });
    list.appendChild(card);
  });
  area.appendChild(list);
}

// ---- 听力题 ----
function renderListen(area, q) {
  const prompt = document.createElement("div");
  prompt.className = "question-prompt";
  prompt.textContent = q.prompt;
  area.appendChild(prompt);

  const listenBox = document.createElement("div");
  listenBox.className = "listen-box";
  const btn = document.createElement("button");
  btn.className = "btn-listen";
  btn.textContent = "🔊";
  btn.addEventListener("click", () => speak(q.audio, true));
  listenBox.appendChild(btn);
  area.appendChild(listenBox);

  setTimeout(() => speak(q.audio), 500);

  const list = document.createElement("div");
  list.className = "option-list";
  const letters = ["A", "B", "C", "D"];
  q.options.forEach((opt, i) => {
    const card = document.createElement("div");
    card.className = "option-card";
    card.innerHTML = `<span class="option-letter">${letters[i]}</span><span class="option-text">${opt}</span>`;
    card.addEventListener("click", () => {
      if (lessonState.answered) return;
      list.querySelectorAll(".option-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      lessonState.selectedAnswer = i;
      $("btn-check").disabled = false;
    });
    list.appendChild(card);
  });
  area.appendChild(list);
}

// ---- 配对题 ----
function renderMatch(area, q) {
  const prompt = document.createElement("div");
  prompt.className = "question-prompt";
  prompt.textContent = q.prompt;
  area.appendChild(prompt);

  const grid = document.createElement("div");
  grid.className = "match-grid";
  const leftItems = q.pairs.map((p, i) => ({ text: p[0], index: i, side: "L" }));
  const rightItems = q.pairs.map((p, i) => ({ text: p[1], index: i, side: "R" }));
  shuffleArrayLocal(leftItems);
  shuffleArrayLocal(rightItems);
  lessonState.matchPairs = [];
  const allItems = [...leftItems, ...rightItems];

  allItems.forEach(item => {
    const el = document.createElement("div");
    el.className = "match-item";
    el.textContent = item.text;
    el.dataset.index = item.index;
    el.dataset.side = item.side;
    el.addEventListener("click", () => {
      if (lessonState.answered) return;
      if (el.classList.contains("matched")) return;
      if (lessonState.matchSelected) {
        const prev = lessonState.matchSelected;
        if (prev.dataset.side === item.side) {
          grid.querySelectorAll(".match-item.selected").forEach(s => s.classList.remove("selected"));
          el.classList.add("selected");
          lessonState.matchSelected = el;
          return;
        }
        if (prev.dataset.index === el.dataset.index) {
          prev.classList.remove("selected");
          prev.classList.add("matched");
          el.classList.add("matched");
          lessonState.matchPairs.push(parseInt(el.dataset.index));
          lessonState.matchSelected = null;
          if (lessonState.matchPairs.length === q.pairs.length) {
            lessonState.selectedAnswer = "done";
            $("btn-check").disabled = false;
            saveRealtime();
          }
        } else {
          el.classList.add("wrong-flash");
          prev.classList.add("wrong-flash");
          setTimeout(() => {
            el.classList.remove("wrong-flash");
            prev.classList.remove("wrong-flash");
          }, 500);
          lessonState.matchSelected = null;
          lessonState.hearts--;
          $("lesson-hearts-value").textContent = lessonState.hearts;
          saveRealtime();
          if (lessonState.hearts <= 0) finishLesson(false);
        }
      } else {
        el.classList.add("selected");
        lessonState.matchSelected = el;
      }
    });
    grid.appendChild(el);
  });
  area.appendChild(grid);
}

// ---- 排序题 ----
function renderOrder(area, q) {
  const prompt = document.createElement("div");
  prompt.className = "question-prompt";
  prompt.textContent = q.prompt;
  area.appendChild(prompt);

  const placed = document.createElement("div");
  placed.className = "order-sentence";
  placed.id = "order-placed";
  const pool = document.createElement("div");
  pool.className = "order-words";
  pool.id = "order-pool";

  const shuffled = [...q.words];
  shuffleArrayLocal(shuffled);
  lessonState.orderWords = shuffled;
  lessonState.orderPlaced = [];

  shuffled.forEach((word, i) => {
    const w = document.createElement("div");
    w.className = "order-word";
    w.textContent = word;
    w.dataset.idx = i;
    w.addEventListener("click", () => {
      if (lessonState.answered) return;
      if (w.parentElement.id === "order-pool") {
        placed.appendChild(w);
        lessonState.orderPlaced.push(word);
      } else {
        pool.appendChild(w);
        lessonState.orderPlaced = lessonState.orderPlaced.filter(w2 => w2 !== word);
      }
      if (lessonState.orderPlaced.length === q.words.length) {
        lessonState.selectedAnswer = "done";
        $("btn-check").disabled = false;
      } else {
        $("btn-check").disabled = true;
      }
      saveRealtime();
    });
    pool.appendChild(w);
  });
  area.appendChild(placed);
  area.appendChild(pool);
}

// ============ 检查答案 ============
function checkAnswer() {
  const q = lessonState.currentLesson.questions[lessonState.questionIndex];
  if (!lessonState.answered && $("btn-check").textContent !== "检查") {
    nextQuestion();
    return;
  }

  lessonState.answered = true;
  let isCorrect = false;
  const fb = $("feedback-bar");

  switch (q.type) {
    case "choice":
    case "fill":
    case "listen": {
      const cards = $("question-area").querySelectorAll(".option-card");
      if (lessonState.selectedAnswer === q.answer) {
        cards[lessonState.selectedAnswer].classList.add("correct");
        isCorrect = true;
      } else {
        if (lessonState.selectedAnswer !== null && cards[lessonState.selectedAnswer]) {
          cards[lessonState.selectedAnswer].classList.add("wrong");
        }
        if (q.answer < cards.length) cards[q.answer].classList.add("correct");
      }
      break;
    }
    case "match": {
      isCorrect = lessonState.matchPairs.length === q.pairs.length;
      break;
    }
    case "order": {
      const userAnswer = lessonState.orderPlaced.join(" ");
      isCorrect = userAnswer.toLowerCase() === q.answer.toLowerCase();
      if (!isCorrect) fb.textContent = `正确答案：${q.answer}`;
      break;
    }
  }

  if (isCorrect) {
    lessonState.correctCount++;
    fb.textContent = "✓ 回答正确！";
    fb.className = "feedback-bar show correct";
    playSound(true);
    state.totalCorrect = (state.totalCorrect || 0) + 1;
    // 如果是复习题目，更新掌握度
    if (q._reviewWord) updateMastery(q._reviewWord, true);
  } else {
    if (q.type !== "order") fb.textContent = "✗ 再接再厉！";
    fb.className = "feedback-bar show wrong";
    playSound(false);
    state.totalWrong = (state.totalWrong || 0) + 1;
    // 提取目标单词并加入错题本
    addToErrorBookFromQuestion(q);
    // 如果是复习题目，重置掌握度
    if (q._reviewWord) updateMastery(q._reviewWord, false);
  }

  // 显示单词注释卡（含错题即时解析）
  showWordAnnotationForQuestion(q, isCorrect);

  const isLast = lessonState.questionIndex >= lessonState.totalQuestions - 1;
  $("btn-check").textContent = isLast ? "完成" : "继续";
  $("btn-check").className = "btn-check continue";
  $("btn-check").disabled = false;

  // 实时保存
  saveRealtime();
}

// ============ 下一题 ============
function nextQuestion() {
  lessonState.questionIndex++;
  if (lessonState.questionIndex >= lessonState.totalQuestions) {
    finishLesson(true);
  } else {
    saveRealtime();
    renderQuestion();
  }
}

// ============ 完成课程 ============
function finishLesson(success) {
  const lesson = lessonState.currentLesson;
  const accuracy = Math.round((lessonState.correctCount / lessonState.totalQuestions) * 100);
  const todayKey = dateKey();

  if (success) {
    const earnedXP = lesson.xp;
    lessonState.earnedXP = earnedXP;
    state.xp += earnedXP;

    if (!state.completedLessons.includes(lesson.id)) {
      state.completedLessons.push(lesson.id);
    }

    // 连胜逻辑
    const todayStr = new Date().toDateString();
    if (state.lastPracticeDate) {
      const last = new Date(state.lastPracticeDate).toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (last === yesterday || last === todayStr) {
        if (last !== todayStr) state.streak++;
      } else {
        state.streak = 1;
      }
    } else {
      state.streak = 1;
    }
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    state.lastPracticeDate = new Date().toISOString();

    // 每日完成数
    state.dailyCompleted++;

    // 打卡记录
    if (!state.checkins[todayKey]) {
      state.checkins[todayKey] = { lessons: 0, xp: 0, titles: [] };
    }
    state.checkins[todayKey].lessons++;
    state.checkins[todayKey].xp += earnedXP;
    state.checkins[todayKey].titles.push(lesson.title);

    if (accuracy === 100) state.gems += 2;

    // 清除断点续学
    state.resumeLesson = null;
    saveState();
  }

  // 完成页
  $("result-icon").textContent = success ? "🎉" : "💔";
  $("result-title").textContent = success ? "课程完成！" : "加油，再来一次！";
  $("result-xp").textContent = (success ? "+" : "") + (success ? lessonState.earnedXP : 0);
  $("result-accuracy").textContent = accuracy + "%";
  $("result-streak").textContent = "🔥 " + state.streak;

  // 打卡信息
  const checkin = state.checkins[todayKey];
  if (checkin) {
    $("result-checkin-info").textContent =
      `📅 今日已学 ${checkin.lessons} 课 · 累计获得 ${checkin.xp} XP · 连胜 ${state.streak} 天`;
  }

  showScreen("result-screen");
}

// ============ 日历渲染 ============
let calYear, calMonth;

function renderCalendar() {
  if (!calYear) {
    const now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth();
  }

  const monthNames = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
  $("cal-month-label").textContent = `${calYear}年 ${monthNames[calMonth]}`;

  // 统计
  const totalDays = Object.keys(state.checkins).length;
  $("cal-current-streak").textContent = state.streak;
  $("cal-total-days").textContent = totalDays;
  $("cal-best-streak").textContent = state.bestStreak;
  $("calendar-stats-text").textContent = `总打卡 ${totalDays} 天 · 最长连胜 ${state.bestStreak} 天`;

  // 日历网格
  const grid = $("calendar-grid");
  grid.innerHTML = "";

  // 星期标题
  ["日","一","二","三","四","五","六"].forEach(d => {
    const wd = document.createElement("div");
    wd.className = "cal-weekday";
    wd.textContent = d;
    grid.appendChild(wd);
  });

  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay = new Date(calYear, calMonth + 1, 0);
  const startWeekday = firstDay.getDay();
  const totalDaysInMonth = lastDay.getDate();
  const todayKey = dateKey();

  // 空格
  for (let i = 0; i < startWeekday; i++) {
    const empty = document.createElement("div");
    empty.className = "cal-day empty";
    grid.appendChild(empty);
  }

  // 日期
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const dayKey = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const cell = document.createElement("div");
    cell.className = "cal-day";
    cell.textContent = d;

    if (state.checkins[dayKey]) {
      cell.classList.add("checked");
    }
    if (dayKey === todayKey) {
      cell.classList.add("today");
    }
    if (new Date(calYear, calMonth, d) > new Date() && dayKey !== todayKey) {
      cell.classList.add("future");
    }

    grid.appendChild(cell);
  }

  // 近期记录
  renderRecentRecords();
}

function renderRecentRecords() {
  const list = $("recent-list");
  list.innerHTML = "";

  const entries = Object.entries(state.checkins)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 10);

  if (entries.length === 0) {
    list.innerHTML = '<div class="recent-empty">还没有学习记录，开始第一课吧！</div>';
    return;
  }

  entries.forEach(([date, data]) => {
    const item = document.createElement("div");
    item.className = "recent-item";
    const d = new Date(date);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
    item.innerHTML = `
      <span class="recent-date">${dateStr}</span>
      <span class="recent-detail">${data.lessons} 课 · ${data.titles.slice(0, 2).join("、")}${data.titles.length > 2 ? "..." : ""}</span>
      <span class="recent-xp">+${data.xp} XP</span>
    `;
    list.appendChild(item);
  });
}

// ============ 提醒通知 ============
function setupReminder() {
  $("reminder-toggle").addEventListener("change", function() {
    state.reminderEnabled = this.checked;
    saveState();
    if (this.checked) {
      requestNotificationPermission();
      scheduleNextReminder();
      showToast("已开启每日提醒，记得每天来学习！");
    } else {
      showToast("已关闭每日提醒");
    }
  });

  $("reminder-time").addEventListener("change", function() {
    state.reminderTime = this.value;
    saveState();
    if (state.reminderEnabled) {
      scheduleNextReminder();
      showToast(`提醒时间已设为 ${this.value}`);
    }
  });

  $("reminder-action").addEventListener("click", () => {
    // 滚动到今日推荐
    $("today-recommend").scrollIntoView({ behavior: "smooth" });
  });

  // 如果已开启，检查是否需要重新调度
  if (state.reminderEnabled) {
    scheduleNextReminder();
  }
}

function requestNotificationPermission() {
  if ("Notification" in window) {
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }
}

function scheduleNextReminder() {
  if (!state.reminderEnabled) return;
  const [h, m] = (state.reminderTime || "20:00").split(":").map(Number);
  const now = new Date();
  const next = new Date();
  next.setHours(h, m, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  const delay = next - now;

  // 用 setTimeout 在应用打开时触发通知
  // 注意：iOS PWA 通知需应用在前台，这里做最佳努力
  setTimeout(() => {
    const todayKey = dateKey();
    if (state.dailyCompleted === 0 && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("英语学习提醒", {
          body: "今天还没学习哦！坚持打卡，保持连胜 🔥",
          icon: "icon.svg",
          tag: "eng-reminder"
        });
      } catch (e) {}
    }
    scheduleNextReminder(); // 递归调度下一天
  }, Math.min(delay, 2147483647)); // setTimeout 最大值
}

function showToast(msg) {
  let toast = $("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.style.cssText = `
      position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.8); color: #fff; padding: 10px 20px;
      border-radius: 12px; font-size: 14px; z-index: 9999;
      opacity: 0; transition: opacity 0.3s; pointer-events: none;
      font-family: var(--font); max-width: 90%; text-align: center;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = "1";
  setTimeout(() => { toast.style.opacity = "0"; }, 2500);
}

// ============ 工具函数 ============
function shuffleArrayLocal(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function speak(text, slow) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = slow ? 0.7 : 0.9;
  window.speechSynthesis.speak(u);
}

let audioCtx = null;
function playSound(correct) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    if (correct) {
      osc.frequency.value = 660;
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);
    } else {
      osc.frequency.value = 220;
      osc.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.2);
    }
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  } catch (e) {}
}

// 查找单元和课程
function findLesson(unitId, lessonId) {
  for (const u of COURSE_DATA) {
    if (u.id === unitId) {
      return { unit: u, lesson: u.lessons.find(l => l.id === lessonId) };
    }
  }
  return null;
}

// ============ 错题本 + 间隔重复系统 (SRS) ============

function addToErrorBook(word, zh) {
  if (!state.errorBook) state.errorBook = {};
  if (!state.errorBook[word]) {
    state.errorBook[word] = { count: 0, lastWrong: dateKey(), mastery: 0, nextReview: dateKey(), zh: zh || "" };
  }
  state.errorBook[word].count++;
  state.errorBook[word].lastWrong = dateKey();
  state.errorBook[word].mastery = 0;
  state.errorBook[word].nextReview = dateKey();
  saveState();
}

function getDueReviews() {
  const today = dateKey();
  if (!state.errorBook) return [];
  return Object.entries(state.errorBook)
    .filter(([word, data]) => data.nextReview <= today && data.mastery < 5)
    .map(([word, data]) => ({ word, ...data }));
}

function updateMastery(word, correct) {
  if (!state.errorBook || !state.errorBook[word]) return;
  const entry = state.errorBook[word];
  if (correct) {
    entry.mastery++;
    const intervals = [0, 1, 2, 4, 7, 14];
    const interval = intervals[Math.min(entry.mastery, intervals.length - 1)];
    const next = new Date();
    next.setDate(next.getDate() + interval);
    entry.nextReview = dateKey(next);
  } else {
    entry.mastery = 0;
    entry.nextReview = dateKey();
  }
  if (entry.mastery >= 5) {
    delete state.errorBook[word];
  }
  saveState();
}

function renderErrorBook() {
  const list = $("error-list");
  if (!list) return;
  list.innerHTML = "";

  const dueReviews = getDueReviews();
  const allErrors = state.errorBook ? Object.entries(state.errorBook) : [];
  
  // 统计
  $("error-count").textContent = allErrors.length;
  $("error-due").textContent = dueReviews.length;
  
  const masteryLevels = allErrors.filter(([w,d]) => d.mastery >= 3).length;
  $("error-mastered").textContent = masteryLevels;
  
  if (allErrors.length === 0) {
    list.innerHTML = '<div class="error-empty"><span style="font-size:48px;">🎉</span><p>错题本为空！</p><p style="color:var(--text-muted);font-size:13px;">做错的题目会自动收集到这里</p></div>';
    return;
  }

  // 到期复习的优先显示
  const sorted = allErrors.sort((a, b) => {
    const aDue = a[1].nextReview <= dateKey() ? 0 : 1;
    const bDue = b[1].nextReview <= dateKey() ? 0 : 1;
    if (aDue !== bDue) return aDue - bDue;
    return b[1].count - a[1].count;
  });

  sorted.forEach(([word, data]) => {
    const isDue = data.nextReview <= dateKey();
    const masteryStars = "★".repeat(data.mastery) + "☆".repeat(5 - data.mastery);
    const item = document.createElement("div");
    item.className = `error-item ${isDue ? "due" : ""}`;
    const detail = getWordDetail(word);
    item.innerHTML = `
      <div class="error-item-header">
        <div class="error-word">${word}</div>
        <div class="error-mastery">${masteryStars}</div>
      </div>
      <div class="error-item-zh">${data.zh || detail.pos || ""}</div>
      ${detail.ipa ? `<div class="error-ipa">/${detail.ipa}/</div>` : ""}
      ${detail.mnemonic ? `<div class="error-mnemonic">💡 ${detail.mnemonic}</div>` : ""}
      <div class="error-item-meta">
        <span>❌ 错${data.count}次</span>
        <span>${isDue ? "🔔 待复习" : "📅 " + data.nextReview}</span>
      </div>
    `;
    list.appendChild(item);
  });

  // 复习按钮
  const reviewBtn = $("btn-start-review");
  if (reviewBtn) {
    reviewBtn.style.display = dueReviews.length > 0 ? "flex" : "none";
  }
}

function startReviewSession() {
  const dueReviews = getDueReviews();
  if (dueReviews.length === 0) {
    showToast("没有到期的复习内容！");
    return;
  }

  // 生成复习题目
  const reviewQuestions = dueReviews.map(r => {
    const detail = getWordDetail(r.word);
    const otherWords = dueReviews.filter(x => x.word !== r.word).slice(0, 3);
    let distractors = otherWords.map(x => x.word);
    while (distractors.length < 3) {
      const random = Object.keys(state.errorBook)[Math.floor(Math.random() * Object.keys(state.errorBook).length)];
      if (r.word !== random && !distractors.includes(random)) distractors.push(random);
    }
    const options = _shuffle([r.word, ...distractors]);
    return {
      type: "choice",
      prompt: `"${r.zh || detail.pos}" 用英语怎么说？`,
      options: options,
      answer: options.indexOf(r.word),
      _reviewWord: r.word,
    };
  });

  // 创建临时复习课程
  const reviewLesson = {
    id: "review_" + dateKey(),
    title: "错题复习",
    xp: 10,
    questions: reviewQuestions,
  };
  const reviewUnit = {
    id: "review",
    title: "错题复习",
    icon: "📝",
    color: "#ff4b4b",
    lessons: [reviewLesson],
  };

  startLesson(reviewUnit, reviewLesson);
}

// ============ 单词注释卡 ============

// 从题目中提取目标单词
function addToErrorBookFromQuestion(q) {
  let word = null, zh = null;
  if (q.type === "choice" || q.type === "fill" || q.type === "listen") {
    if (q.answer != null && q.options && q.options[q.answer]) {
      word = q.options[q.answer];
    }
    // 从 prompt 中提取中文
    const match = q.prompt && q.prompt.match(/"([^"]+)"/);
    if (match) zh = match[1];
  } else if (q.type === "order") {
    word = q.answer;
  }
  if (word && word.length > 0 && word.length < 50) {
    addToErrorBook(word, zh);
  }
}

// 从题目中提取单词并显示注释（含错题即时解析）
function showWordAnnotationForQuestion(q, isCorrect) {
  let correctWord = null, userAnswer = null, zh = null;
  
  if (q.type === "choice" || q.type === "fill" || q.type === "listen") {
    if (q.answer != null && q.options && q.options[q.answer]) {
      correctWord = q.options[q.answer];
    }
    if (!isCorrect && lessonState.selectedAnswer != null && q.options && q.options[lessonState.selectedAnswer]) {
      userAnswer = q.options[lessonState.selectedAnswer];
    }
    const match = q.prompt && q.prompt.match(/"([^"]+)"/);
    if (match) zh = match[1];
  } else if (q.type === "order") {
    correctWord = q.answer;
    if (!isCorrect) userAnswer = lessonState.orderPlaced ? lessonState.orderPlaced.join(" ") : "";
  }

  if (correctWord) {
    showInstantAnalysis(correctWord, userAnswer, zh, isCorrect, q);
  } else {
    const panel = $("word-annotation");
    if (panel) panel.style.display = "none";
  }
}

// 即时解析卡：答错时显示完整解析
function showInstantAnalysis(correctWord, userAnswer, zh, isCorrect, q) {
  const detail = getWordDetail(correctWord);
  const panel = $("word-annotation");
  if (!panel) return;

  let html = "";

  // ── 答错时：显示错题对比 + 完整解析 ──
  if (!isCorrect) {
    html += `<div class="ia-section ia-compare">`;
    if (userAnswer) {
      html += `<div class="ia-compare-row ia-wrong">❌ 你的答案：<b>${userAnswer}</b></div>`;
    }
    html += `<div class="ia-compare-row ia-correct">✓ 正确答案：<b>${correctWord}</b></div>`;
    html += `</div>`;
  }

  // ── 单词详情 ──
  html += `<div class="ia-word-card">`;
  html += `<div class="ia-word-header">`;
  html += `<span class="ia-word">${correctWord}</span>`;
  if (detail.ipa) html += `<span class="ia-ipa">${detail.ipa}</span>`;
  if (detail.pos) html += `<span class="ia-pos">${detail.pos}</span>`;
  if (zh) html += `<span class="ia-zh">${zh}</span>`;
  html += `</div>`;

  // 朗读按钮
  html += `<div class="ia-actions">`;
  html += `<button class="ia-speak-btn" onclick="speak('${correctWord.replace(/'/g, "\\'")}')">🔊 读单词</button>`;
  if (detail.ex) {
    html += `<button class="ia-speak-btn" onclick="speak('${detail.ex.replace(/'/g, "\\'")}')">🔊 读例句</button>`;
  }
  html += `</div>`;

  // 例句
  if (detail.ex) {
    html += `<div class="ia-example">`;
    html += `<div class="ia-ex-en">${detail.ex}</div>`;
    if (detail.exZh) html += `<div class="ia-ex-zh">${detail.exZh}</div>`;
    html += `</div>`;
  }

  // 记忆法
  if (detail.mnemonic) {
    html += `<div class="ia-mnemonic">💡 <b>记忆法：</b>${detail.mnemonic}</div>`;
  }

  // 常见搭配
  if (detail.collocations && detail.collocations.length > 0) {
    html += `<div class="ia-collocations"><b>常见搭配：</b>${detail.collocations.map(c => `<span class="ia-coll">${c}</span>`).join("")}</div>`;
  }

  html += `</div>`;

  // ── 语法解析 ──
  const themeName = lessonState.currentUnit ? lessonState.currentUnit.title : null;
  const grammar = getGrammarForTheme(themeName);
  if (grammar) {
    html += `<div class="ia-grammar">`;
    html += `<div class="ia-grammar-title">📐 ${grammar.title}</div>`;
    html += `<div class="ia-grammar-rule">${grammar.rule}</div>`;
    html += `<div class="ia-grammar-explain">${grammar.explanation}</div>`;
    if (grammar.examples && grammar.examples.length > 0) {
      html += `<div class="ia-grammar-examples">`;
      grammar.examples.forEach(ex => {
        html += `<div class="ia-grammar-ex">`;
        html += `<div class="ia-grammar-ex-en">${ex.en} <button class="ia-speak-mini" onclick="speak('${ex.en.replace(/'/g, "\\'")}')">🔊</button></div>`;
        html += `<div class="ia-grammar-ex-zh">${ex.zh}</div>`;
        if (ex.note) html += `<div class="ia-grammar-ex-note">📌 ${ex.note}</div>`;
        html += `</div>`;
      });
      html += `</div>`;
    }
    if (grammar.commonErrors) {
      html += `<div class="ia-grammar-errors">${grammar.commonErrors}</div>`;
    }
    html += `</div>`;
  }

  // ── 提示语 ──
  if (!isCorrect) {
    html += `<div class="ia-tip">📌 这个单词已加入错题本，系统会按 <b>1天→2天→4天→7天→14天</b> 间隔提醒你复习</div>`;
  }

  panel.innerHTML = html;
  panel.style.display = "block";
  panel.className = `word-annotation ${isCorrect ? "show-correct" : "show-wrong ia-expanded"}`;
}

function showWordAnnotation(word, isCorrect) {
  const detail = getWordDetail(word);
  const panel = $("word-annotation");
  if (!panel) return;

  if (!detail.ipa && !detail.ex && !detail.mnemonic) {
    panel.style.display = "none";
    return;
  }

  let html = `<div class="ann-header ${isCorrect ? "correct" : "wrong"}">`;
  html += `<span class="ann-word">${word}</span>`;
  if (detail.ipa) html += `<span class="ann-ipa">${detail.ipa}</span>`;
  if (detail.pos) html += `<span class="ann-pos">${detail.pos}</span>`;
  html += `</div>`;

  if (detail.ex) {
    html += `<div class="ann-example">`;
    html += `<div class="ann-ex-en">${detail.ex} <button class="ann-speak" onclick="speak('${detail.ex.replace(/'/g, "\\'")}')">🔊</button></div>`;
    if (detail.exZh) html += `<div class="ann-ex-zh">${detail.exZh}</div>`;
    html += `</div>`;
  }

  if (detail.mnemonic) {
    html += `<div class="ann-mnemonic">💡 ${detail.mnemonic}</div>`;
  }

  if (detail.collocations && detail.collocations.length > 0) {
    html += `<div class="ann-collocations">搭配：${detail.collocations.map(c => `<span class="ann-coll">${c}</span>`).join("")}</div>`;
  }

  panel.innerHTML = html;
  panel.style.display = "block";
  panel.className = `word-annotation ${isCorrect ? "show-correct" : "show-wrong"}`;
}

// ============ 语法解析面板 ============

function showGrammarPanel(themeName) {
  const grammar = getGrammarForTheme(themeName);
  const panel = $("grammar-panel");
  if (!panel || !grammar) {
    if (panel) panel.style.display = "none";
    return;
  }

  let html = `<div class="grammar-card">`;
  html += `<div class="grammar-title">📐 ${grammar.title}</div>`;
  html += `<div class="grammar-rule">${grammar.rule}</div>`;
  html += `<div class="grammar-explanation">${grammar.explanation}</div>`;
  
  if (grammar.examples) {
    html += `<div class="grammar-examples">`;
    grammar.examples.forEach(ex => {
      html += `<div class="grammar-ex">`;
      html += `<div class="grammar-ex-en">${ex.en} <button class="ann-speak" onclick="speak('${ex.en.replace(/'/g, "\\'")}')">🔊</button></div>`;
      html += `<div class="grammar-ex-zh">${ex.zh}</div>`;
      if (ex.note) html += `<div class="grammar-ex-note">📌 ${ex.note}</div>`;
      html += `</div>`;
    });
    html += `</div>`;
  }

  if (grammar.commonErrors) {
    html += `<div class="grammar-errors">${grammar.commonErrors}</div>`;
  }
  html += `</div>`;

  panel.innerHTML = html;
  panel.style.display = "block";
}

// ============ 口语练习 ============

let speakingState = null;

function renderSpeakingList() {
  const list = $("speaking-list");
  if (!list) return;
  list.innerHTML = "";

  SPEAKING_PRACTICE.forEach(scenario => {
    const score = state.speakingScores[scenario.id];
    const card = document.createElement("div");
    card.className = "speaking-card";
    card.style.borderLeftColor = scenario.color;
    card.innerHTML = `
      <div class="speaking-icon" style="background:${scenario.color}">${scenario.icon}</div>
      <div class="speaking-info">
        <div class="speaking-title">${scenario.title}</div>
        <div class="speaking-meta">
          <span class="speaking-diff">${scenario.difficulty}</span>
          <span>${scenario.dialogues.filter(d => d.isUser).length} 句跟读</span>
          ${score ? `<span class="speaking-score">最高 ${score.bestScore}%</span>` : ""}
        </div>
      </div>
      <span class="speaking-arrow">›</span>
    `;
    card.addEventListener("click", () => startSpeakingPractice(scenario));
    list.appendChild(card);
  });
}

function startSpeakingPractice(scenario) {
  speakingState = {
    scenario: scenario,
    currentIndex: 0,
    scores: [],
    isPlaying: false,
  };

  $("speaking-title").textContent = scenario.title;
  $("speaking-scenario").textContent = scenario.scenario;
  showScreen("speaking-screen");
  renderSpeakingDialogue();
}

function renderSpeakingDialogue() {
  if (!speakingState) return;
  const scenario = speakingState.scenario;
  const idx = speakingState.currentIndex;
  const dialogue = scenario.dialogues[idx];
  
  if (!dialogue) {
    finishSpeakingPractice();
    return;
  }

  const area = $("speaking-dialogue-area");
  
  // 显示进度
  const pct = (idx / scenario.dialogues.length) * 100;
  $("speaking-progress-fill").style.width = pct + "%";
  $("speaking-progress-text").textContent = `${idx + 1} / ${scenario.dialogues.length}`;

  if (dialogue.isUser) {
    // 用户需要跟读的句子
    area.innerHTML = `
      <div class="speak-prompt">🔊 请跟读这句话：</div>
      <div class="speak-target">${dialogue.text}</div>
      <div class="speak-target-zh">${dialogue.translation}</div>
      <div class="speak-actions">
        <button class="btn-speak-play" id="btn-speak-play">🔊 听原声</button>
        <button class="btn-speak-record" id="btn-speak-record">🎙️ 开始录音</button>
      </div>
      <div class="speak-result" id="speak-result"></div>
    `;

    $("btn-speak-play").addEventListener("click", () => {
      speak(dialogue.text, true);
    });

    $("btn-speak-record").addEventListener("click", () => {
      startPronunciationCheck(dialogue.text);
    });
  } else {
    // NPC的台词
    area.innerHTML = `
      <div class="speak-npc">
        <div class="speak-npc-name">${dialogue.speaker}</div>
        <div class="speak-npc-text">${dialogue.text}</div>
        <div class="speak-npc-zh">${dialogue.translation}</div>
        <button class="btn-speak-next" id="btn-speak-next">继续 →</button>
      </div>
    `;
    // 自动播放NPC语音
    setTimeout(() => speak(dialogue.text, false), 300);
    $("btn-speak-next").addEventListener("click", () => {
      speakingState.currentIndex++;
      renderSpeakingDialogue();
    });
  }
}

function startPronunciationCheck(targetText) {
  const resultDiv = $("speak-result");
  const recordBtn = $("btn-speak-record");

  // 使用 Web Speech API
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    // 不支持语音识别，用 TTS 替代练习
    resultDiv.innerHTML = `
      <div class="speak-score-card">
        <div class="speak-score-label">📱 你的设备不支持语音识别</div>
        <div class="speak-score-tip">请点击"听原声"反复跟读练习，模仿发音和语调</div>
        <button class="btn-speak-next" id="btn-speak-fallback">我已练习，下一句 →</button>
      </div>
    `;
    speak(targetText, true);
    $("btn-speak-fallback").addEventListener("click", () => {
      speakingState.scores.push(80); // 默认给及格分
      speakingState.currentIndex++;
      renderSpeakingDialogue();
    });
    return;
  }

  recordBtn.textContent = "🔴 录音中...";
  recordBtn.disabled = true;

  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const recognized = event.results[0][0].transcript.toLowerCase().replace(/[.,!?]/g, "");
    const target = targetText.toLowerCase().replace(/[.,!?]/g, "");
    const score = scorePronunciation(target, recognized);
    speakingState.scores.push(score);

    let level = score >= 80 ? "excellent" : score >= 60 ? "good" : "needs-work";
    let levelText = score >= 80 ? "🎉 优秀！" : score >= 60 ? "👍 不错！" : "💪 继续练习！";
    let levelColor = score >= 80 ? "var(--green)" : score >= 60 ? "var(--blue)" : "var(--red)";

    resultDiv.innerHTML = `
      <div class="speak-score-card">
        <div class="speak-score-num" style="color:${levelColor}">${score}<span>%</span></div>
        <div class="speak-score-level">${levelText}</div>
        <div class="speak-recognized">
          <div class="speak-rec-label">你说的：</div>
          <div class="speak-rec-text">${event.results[0][0].transcript}</div>
        </div>
        <div class="speak-target-compare">
          <div class="speak-rec-label">目标句：</div>
          <div class="speak-rec-text">${targetText}</div>
        </div>
        <button class="btn-speak-next" id="btn-speak-next">下一句 →</button>
      </div>
    `;
    
    $("btn-speak-next").addEventListener("click", () => {
      speakingState.currentIndex++;
      renderSpeakingDialogue();
    });
  };

  recognition.onerror = () => {
    recordBtn.textContent = "🎙️ 开始录音";
    recordBtn.disabled = false;
    resultDiv.innerHTML = `<div class="speak-error">⚠️ 识别失败，请重试或检查麦克风权限</div>`;
  };

  recognition.onend = () => {
    recordBtn.textContent = "🎙️ 开始录音";
    recordBtn.disabled = false;
  };

  try {
    recognition.start();
  } catch (e) {
    recordBtn.textContent = "🎙️ 开始录音";
    recordBtn.disabled = false;
    resultDiv.innerHTML = `<div class="speak-error">⚠️ 无法启动录音，请重试</div>`;
  }
}

function scorePronunciation(target, recognized) {
  const targetWords = target.split(/\s+/).filter(w => w.length > 0);
  const recWords = recognized.split(/\s+/).filter(w => w.length > 0);
  if (targetWords.length === 0) return 0;

  let correct = 0;
  let recUsed = new Array(recWords.length).fill(false);

  targetWords.forEach(tw => {
    for (let i = 0; i < recWords.length; i++) {
      if (!recUsed[i] && (recWords[i] === tw || recWords[i].includes(tw) || tw.includes(recWords[i]))) {
        correct++;
        recUsed[i] = true;
        break;
      }
    }
  });

  // 词序加分
  let orderScore = 0;
  let lastIdx = -1;
  targetWords.forEach(tw => {
    const idx = recWords.indexOf(tw, lastIdx + 1);
    if (idx > lastIdx) {
      orderScore++;
      lastIdx = idx;
    }
  });

  const wordScore = (correct / targetWords.length) * 70;
  const orderBonus = (orderScore / targetWords.length) * 30;
  return Math.min(100, Math.round(wordScore + orderBonus));
}

function finishSpeakingPractice() {
  if (!speakingState) return;
  const scores = speakingState.scores;
  const avgScore = scores.length > 0 
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) 
    : 0;
  
  const scenarioId = speakingState.scenario.id;
  if (!state.speakingScores) state.speakingScores = {};
  const prev = state.speakingScores[scenarioId] || { bestScore: 0, attempts: 0 };
  state.speakingScores[scenarioId] = {
    bestScore: Math.max(prev.bestScore, avgScore),
    attempts: prev.attempts + 1,
    lastScore: avgScore,
  };
  state.xp += Math.round(avgScore / 10);
  saveState();

  // 显示结果
  const area = $("speaking-dialogue-area");
  let level = avgScore >= 80 ? "🎉" : avgScore >= 60 ? "👍" : "💪";
  area.innerHTML = `
    <div class="speak-finish">
      <div class="speak-finish-icon">${level}</div>
      <div class="speak-finish-title">练习完成！</div>
      <div class="speak-finish-score">${avgScore}<span>%</span></div>
      <div class="speak-finish-label">平均发音得分</div>
      <div class="speak-finish-stats">
        <span>共 ${scores.length} 句跟读</span>
        <span>+${Math.round(avgScore / 10)} XP</span>
      </div>
      <div class="speak-finish-actions">
        <button class="btn-speak-retry" id="btn-speak-retry">🔄 再练一次</button>
        <button class="btn-speak-back" id="btn-speak-back">返回列表</button>
      </div>
    </div>
  `;

  $("btn-speak-retry").addEventListener("click", () => {
    startSpeakingPractice(speakingState.scenario);
  });
  $("btn-speak-back").addEventListener("click", () => {
    speakingState = null;
    showScreen("speaking-list-screen");
    renderSpeakingList();
  });
}

// ============ 事件绑定 ============
document.addEventListener("DOMContentLoaded", () => {
  try { renderHome(); } catch(e) { console.error("renderHome error:", e); }
  try { renderCalendar(); } catch(e) { console.error("renderCalendar error:", e); }
  try { renderErrorBook(); } catch(e) { console.error("renderErrorBook error:", e); }
  try { renderSpeakingList(); } catch(e) { console.error("renderSpeakingList error:", e); }
  try { setupReminder(); } catch(e) { console.error("setupReminder error:", e); }

  // 检查答案按钮
  try {
    $("btn-check").addEventListener("click", () => {
      if ($("btn-check").textContent === "检查") {
        checkAnswer();
      } else {
        nextQuestion();
      }
    });
  } catch(e) { console.error("btn-check error:", e); }

  // 跳过按钮
  try {
    $("btn-skip").addEventListener("click", () => {
      if (lessonState.questionIndex < lessonState.totalQuestions - 1) {
        lessonState.questionIndex++;
        saveRealtime();
        renderQuestion();
      } else {
        finishLesson(true);
      }
    });
  } catch(e) { console.error("btn-skip error:", e); }

  // 退出按钮
  try {
    $("btn-exit-lesson").addEventListener("click", () => {
      if (confirm("退出本次练习？进度将自动保存，下次可继续。")) {
        saveRealtime();
        showScreen("home-screen");
        renderHome();
      }
    });
  } catch(e) { console.error("btn-exit error:", e); }

  // 继续学习按钮
  try {
    $("btn-continue").addEventListener("click", () => {
      showScreen("home-screen");
      renderHome();
    });
  } catch(e) { console.error("btn-continue error:", e); }

  // 错题复习按钮
  try {
    const reviewBtn = $("btn-start-review");
    if (reviewBtn) {
      reviewBtn.addEventListener("click", () => startReviewSession());
    }
  } catch(e) { console.error("btn-review error:", e); }

  // 口语练习退出按钮
  try {
    const speakExit = $("btn-speak-exit");
    if (speakExit) {
      speakExit.addEventListener("click", () => {
        speakingState = null;
        showScreen("speaking-list-screen");
        renderSpeakingList();
      });
    }
  } catch(e) { console.error("btn-speak-exit error:", e); }

  // 底部导航
  try {
    document.querySelectorAll(".nav-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const screen = btn.dataset.screen;
        if (screen === "calendar-screen") renderCalendar();
        if (screen === "home-screen") renderHome();
        if (screen === "error-screen") renderErrorBook();
        if (screen === "speaking-list-screen") renderSpeakingList();
        showScreen(screen);
      });
    });
  } catch(e) { console.error("nav error:", e); }

  // 日历导航
  try {
    $("cal-prev").addEventListener("click", () => {
      calMonth--;
      if (calMonth < 0) { calMonth = 11; calYear--; }
      renderCalendar();
    });
    $("cal-next").addEventListener("click", () => {
      calMonth++;
      if (calMonth > 11) { calMonth = 0; calYear++; }
      renderCalendar();
    });
  } catch(e) { console.error("cal-nav error:", e); }

  // 断点续学提示
  try {
    if (state.resumeLesson) {
      setTimeout(() => {
        if (confirm("检测到上次未完成的练习，是否继续？")) {
          resumeLesson();
        } else {
          state.resumeLesson = null;
          saveState();
        }
      }, 500);
    }
  } catch(e) { console.error("resume error:", e); }

  // Service Worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
});
