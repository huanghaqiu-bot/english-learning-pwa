/**
 * 英语学习工作台 — 应用逻辑 v2
 * 新增功能：日历打卡 / 实时保存 / 每日提醒 / 断点续学 / 今日推荐
 */

// ============ 状态管理 ============
const STORAGE_KEY = "eng_learn_state_v2";

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
  const showNav = screenId === "home-screen" || screenId === "calendar-screen";
  $("bottom-nav").style.display = showNav ? "flex" : "none";
  // 导航高亮
  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.screen === screenId);
  });
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
  } else {
    if (q.type !== "order") fb.textContent = "✗ 再接再厉！";
    fb.className = "feedback-bar show wrong";
    playSound(false);
  }

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

// ============ 事件绑定 ============
document.addEventListener("DOMContentLoaded", () => {
  renderHome();
  renderCalendar();
  setupReminder();

  // 检查答案按钮
  $("btn-check").addEventListener("click", () => {
    if ($("btn-check").textContent === "检查") {
      checkAnswer();
    } else {
      nextQuestion();
    }
  });

  // 跳过按钮
  $("btn-skip").addEventListener("click", () => {
    if (lessonState.questionIndex < lessonState.totalQuestions - 1) {
      lessonState.questionIndex++;
      saveRealtime();
      renderQuestion();
    } else {
      finishLesson(true);
    }
  });

  // 退出按钮
  $("btn-exit-lesson").addEventListener("click", () => {
    if (confirm("退出本次练习？进度将自动保存，下次可继续。")) {
      saveRealtime();
      showScreen("home-screen");
      renderHome();
    }
  });

  // 继续学习按钮
  $("btn-continue").addEventListener("click", () => {
    showScreen("home-screen");
    renderHome();
  });

  // 底部导航
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const screen = btn.dataset.screen;
      if (screen === "calendar-screen") renderCalendar();
      if (screen === "home-screen") renderHome();
      showScreen(screen);
    });
  });

  // 日历导航
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

  // 断点续学提示
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

  // Service Worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
});
