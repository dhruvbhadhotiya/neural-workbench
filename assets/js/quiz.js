/* ==========================================================================
   DeepLearn Lab — quiz.js
   Renders lesson quizzes (8 questions) and module exams (10 questions).
   Data lives in a <script type="application/json" class="quiz__data"> child.
   ========================================================================== */
(function (DL) {
  "use strict";

  function shuffleWith(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function readData(el, opts) {
    if (opts && opts.questions) return opts;
    var script = el.querySelector("script.quiz__data");
    if (!script) return null;
    try { return JSON.parse(script.textContent); }
    catch (e) { return null; }
  }

  DL.quiz = {
    mount: function (el, opts) {
      opts = opts || {};
      var data = readData(el, opts);
      if (!data) {
        el.appendChild(DL.el("p", { class: "lab__loading", text: "Quiz data missing." }));
        return null;
      }

      var id = opts.id || el.getAttribute("data-quiz") || "quiz";
      var isExam = opts.exam || el.getAttribute("data-exam") === "1";
      var questions = data.questions || [];
      var rng = DL.rng(DL.hash(id + "-shuffle"));
      var locked = false;

      // stable shuffle of each question's options, tracking the correct index
      var prepared = questions.map(function (q) {
        var idxs = q.options.map(function (_, i) { return i; });
        var order = (data.shuffle === false || opts.shuffle === false) ? idxs : shuffleWith(idxs, rng);
        return {
          q: q.q,
          why: q.why || [],
          order: order,
          correct: order.indexOf(q.correct),
          options: order.map(function (i) { return q.options[i]; })
        };
      });

      el.innerHTML = "";
      var head = DL.el("header", { class: "quiz__head" }, [
        DL.el("h3", { text: data.title || opts.title || (isExam ? "Module exam" : "Check yourself") }),
        DL.el("span", { class: "badge badge--module", text: questions.length + " questions" }),
        DL.el("span", { class: "quiz__progress", text: "0 / " + questions.length + " answered" })
      ]);
      var body = DL.el("div", { class: "quiz__body" });
      var scoreEl = DL.el("span", { class: "quiz__score", text: isExam ? "Not submitted" : "No score yet" });
      var statusEl = DL.el("span", { class: "quiz__status" });
      var checkBtn = DL.el("button", { type: "button", class: "btn btn--accent", text: isExam ? "Submit exam" : "Check answers" });
      var resetBtn = DL.el("button", { type: "button", class: "btn", text: "Reset" });
      var foot = DL.el("footer", { class: "quiz__foot" }, [checkBtn, resetBtn, scoreEl, statusEl]);

      var groups = [];

      prepared.forEach(function (q, qi) {
        var fs = DL.el("fieldset", { class: "quiz__q", style: { border: "0", padding: "0", margin: "0" } });
        var legend = DL.el("legend", { class: "quiz__stem" }, [
          DL.el("span", { class: "quiz__qnum", text: DL.pad2(qi + 1) }),
          DL.el("span", { html: q.q })
        ]);
        fs.appendChild(legend);
        var list = DL.el("ul", { class: "quiz__opts" });
        var name = "q-" + DL.hash(id + "-" + qi);
        var inputs = [];

        q.options.forEach(function (optText, oi) {
          var inputId = name + "-" + oi;
          var input = DL.el("input", {
            type: "radio", name: name, id: inputId, value: String(oi),
            "aria-label": "Option " + (oi + 1)
          });
          var label = DL.el("label", { for: inputId }, [
            input, DL.el("span", { html: optText })
          ]);
          var li = DL.el("li", { class: "quiz__opt" }, [label]);
          var why = DL.el("p", { class: "quiz__why", hidden: "", html: q.why[oi] || "" });
          li.appendChild(why);
          input.addEventListener("change", function () {
            updateProgress();
            if (!isExam && !locked) return;
          });
          inputs.push({ input: input, li: li, why: why });
          list.appendChild(li);
        });

        fs.appendChild(list);
        body.appendChild(fs);
        groups.push({ fs: fs, inputs: inputs, correct: q.correct, answered: false });
      });

      function updateProgress() {
        var answered = 0;
        groups.forEach(function (g) {
          var any = g.inputs.some(function (o) { return o.input.checked; });
          g.answered = any;
          if (any) answered++;
        });
        head.querySelector(".quiz__progress").textContent = answered + " / " + questions.length + " answered";
      }

      function grade() {
        var correct = 0;
        groups.forEach(function (g) {
          var chosen = -1;
          g.inputs.forEach(function (o, i) { if (o.input.checked) chosen = i; });
          g.inputs.forEach(function (o, i) {
            o.input.disabled = true;
            o.li.classList.remove("is-correct", "is-wrong", "is-dim");
            if (i === g.correct) {
              o.li.classList.add("is-correct");
              o.why.hidden = false;
            } else if (i === chosen) {
              o.li.classList.add("is-wrong");
              o.why.hidden = false;
            } else {
              o.li.classList.add("is-dim");
              o.why.hidden = true;
            }
          });
          if (chosen === g.correct) correct++;
        });
        locked = true;
        var pct = correct / questions.length;
        scoreEl.textContent = correct + " / " + questions.length + " (" + Math.round(pct * 100) + "%)";
        scoreEl.classList.remove("is-pass", "is-fail");
        scoreEl.classList.add(pct >= 0.75 ? "is-pass" : "is-fail");
        statusEl.textContent = isExam
          ? (pct >= 0.7 ? "Passed — review the explanations below." : "Below 70% — revisit the weak lessons.")
          : (pct === 1 ? "Perfect." : "Read the explanations, then reset and retry.");
        DL.store.set("quiz." + id, {
          score: correct, total: questions.length, at: Date.now()
        });
        if (DL.progress && DL.progress.setQuizScore) {
          DL.progress.setQuizScore(id, { correct: correct, total: questions.length });
        }
        checkBtn.disabled = true;
        checkBtn.textContent = "Checked";
      }

      function reset() {
        locked = false;
        groups.forEach(function (g) {
          g.inputs.forEach(function (o) {
            o.input.checked = false;
            o.input.disabled = false;
            o.li.classList.remove("is-correct", "is-wrong", "is-dim");
            o.why.hidden = true;
          });
        });
        scoreEl.textContent = isExam ? "Not submitted" : "No score yet";
        scoreEl.classList.remove("is-pass", "is-fail");
        statusEl.textContent = "";
        checkBtn.disabled = false;
        checkBtn.textContent = isExam ? "Submit exam" : "Check answers";
        updateProgress();
      }

      checkBtn.addEventListener("click", grade);
      resetBtn.addEventListener("click", reset);

      el.appendChild(head);
      el.appendChild(body);
      el.appendChild(foot);

      // restore previous score display
      var prev = DL.store.get("quiz." + id, null);
      if (prev && prev.total) {
        statusEl.textContent = "Best so far: " + prev.score + "/" + prev.total;
      }
      updateProgress();

      return { grade: grade, reset: reset, id: id };
    }
  };
})(window.DL);
