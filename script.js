/*
 * KAALCHAKRA - CLEAN FRONTEND SCRIPT
 * ------------------------------------------------------------
 * Works with the existing index.html and style.css.
 *
 * Features:
 * - Live analog + digital clock
 * - 12/24 hour toggle
 * - Alarm + repeating alarm sound
 * - Stopwatch
 * - Countdown timer + completion sound
 * - Modal open/close controls
 * - Voice recognition
 * - General AI questions through http://localhost:3000/api/ask
 * - AI clock actions (alarm/timer/stopwatch/format)
 * - Speech output
 */

(() => {
    "use strict";

    // =========================================================
    // DOM
    // =========================================================

    const $ = (id) => document.getElementById(id);

    // Clock
    const hourHand = document.querySelector(".hour-hand");
    const minuteHand = document.querySelector(".minute-hand");
    const secondHand = document.querySelector(".second-hand");
    const digitalTime = $("digitalTime");
    const dateDisplay = $("dateDisplay");
    const periodDisplay = $("period");

    // Main buttons
    const alarmBtn = $("alarmBtn");
    const stopwatchBtn = $("stopwatchBtn");
    const timerBtn = $("timerBtn");
    const formatBtn = $("formatBtn");
    const voiceButton = $("voiceBtn");
    const statusText = $("status");

    // Modals
    const alarmModal = $("alarmModal");
    const stopwatchModal = $("stopwatchModal");
    const timerModal = $("timerModal");
    const closeAlarm = $("closeAlarm");
    const closeStopwatch = $("closeStopwatch");
    const closeTimer = $("closeTimer");

    // Alarm
    const alarmHour = $("alarmHour");
    const alarmMinute = $("alarmMinute");
    const alarmPeriod = $("alarmPeriod");
    const setAlarmBtn = $("setAlarm");
    const cancelAlarmBtn = $("cancelAlarm");
    const alarmStatus = $("alarmStatus");
    const ringingOverlay = $("ringingOverlay");
    const stopAlarmBtn = $("stopAlarm");

    // Stopwatch
    const stopwatchDisplay = $("stopwatchDisplay");
    const startStopwatchBtn = $("startStopwatch");
    const resetStopwatchBtn = $("resetStopwatch");

    // Timer
    const timerHours = $("timerHours");
    const timerMinutes = $("timerMinutes");
    const timerSeconds = $("timerSeconds");
    const timerDisplay = $("timerDisplay");
    const timerStatus = $("timerStatus");
    const startTimerBtn = $("startTimer");
    const resetTimerBtn = $("resetTimer");
    const timerCompleteOverlay = $("timerCompleteOverlay");
    const dismissTimerBtn = $("dismissTimer");

    // =========================================================
    // STATE
    // =========================================================

    let is24Hour = false;

    // Alarm
    let alarmTarget = null;
    let alarmActive = false;
    let alarmRingTimer = null;

    // Audio
    let audioContext = null;
    let alarmToneTimer = null;

    // Stopwatch
    let stopwatchRunning = false;
    let stopwatchStart = 0;
    let stopwatchElapsed = 0;
    let stopwatchTimer = null;

    // Timer
    let timerRunning = false;
    let timerEnd = 0;
    let timerRemaining = 0;
    let timerInterval = null;
    let timerSoundTimer = null;

    // Voice
    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let recognitionBusy = false;

    // =========================================================
    // STATUS
    // =========================================================

    function setStatus(message) {
        if (statusText) {
            statusText.textContent = String(message);
        }
        console.log("[KaalChakra]", message);
    }

    function setTimerStatus(message) {
        if (timerStatus) {
            timerStatus.textContent = String(message);
        }
    }

    // =========================================================
    // MODALS
    // =========================================================

    function openModal(modal) {
        if (modal) {
            modal.classList.add("active");
        }
    }

    function closeModal(modal) {
        if (modal) {
            modal.classList.remove("active");
        }
    }

    alarmBtn?.addEventListener("click", () => openModal(alarmModal));
    stopwatchBtn?.addEventListener("click", () => openModal(stopwatchModal));
    timerBtn?.addEventListener("click", () => openModal(timerModal));

    closeAlarm?.addEventListener("click", () => closeModal(alarmModal));
    closeStopwatch?.addEventListener("click", () => closeModal(stopwatchModal));
    closeTimer?.addEventListener("click", () => closeModal(timerModal));

    // Clicking the dark area outside a panel closes that modal.
    [alarmModal, stopwatchModal, timerModal].forEach((modal) => {
        modal?.addEventListener("click", (event) => {
            if (event.target === modal) {
                closeModal(modal);
            }
        });
    });

    // =========================================================
    // AUDIO
    // =========================================================

    function ensureAudio() {
        try {
            const AudioContextClass =
                window.AudioContext || window.webkitAudioContext;

            if (!AudioContextClass) {
                return null;
            }

            if (!audioContext) {
                audioContext = new AudioContextClass();
            }

            if (audioContext.state === "suspended") {
                audioContext.resume().catch(() => {});
            }

            return audioContext;
        } catch (error) {
            console.warn("Audio is unavailable:", error);
            return null;
        }
    }

    function beep({
        frequency = 880,
        duration = 0.35,
        volume = 0.25,
        type = "sine"
    } = {}) {
        const ctx = ensureAudio();
        if (!ctx) return;

        try {
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            const now = ctx.currentTime;

            oscillator.type = type;
            oscillator.frequency.setValueAtTime(frequency, now);

            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(
                Math.max(volume, 0.001),
                now + 0.02
            );
            gain.gain.exponentialRampToValueAtTime(
                0.0001,
                now + duration
            );

            oscillator.connect(gain);
            gain.connect(ctx.destination);

            oscillator.start(now);
            oscillator.stop(now + duration + 0.03);
        } catch (error) {
            console.warn("Could not play tone:", error);
        }
    }

    function startAlarmSound() {
        stopAlarmSound();

        // Start immediately, then repeat the two-tone alarm.
        const playPattern = () => {
            beep({
                frequency: 880,
                duration: 0.28,
                volume: 0.32,
                type: "square"
            });

            setTimeout(() => {
                if (!alarmActive) return;
                beep({
                    frequency: 660,
                    duration: 0.28,
                    volume: 0.32,
                    type: "square"
                });
            }, 320);
        };

        playPattern();
        alarmToneTimer = setInterval(playPattern, 1200);
    }

    function stopAlarmSound() {
        if (alarmToneTimer) {
            clearInterval(alarmToneTimer);
            alarmToneTimer = null;
        }
    }

    function startTimerSound() {
        stopTimerSound();

        const playPattern = () => {
            beep({ frequency: 880, duration: 0.22, volume: 0.28 });
            setTimeout(() => beep({
                frequency: 660,
                duration: 0.22,
                volume: 0.28
            }), 260);
        };

        playPattern();
        timerSoundTimer = setInterval(playPattern, 1200);
    }

    function stopTimerSound() {
        if (timerSoundTimer) {
            clearInterval(timerSoundTimer);
            timerSoundTimer = null;
        }
    }

    // =========================================================
    // SPEECH OUTPUT
    // =========================================================

    function speakResponse(text) {
        if (!("speechSynthesis" in window)) {
            return;
        }

        const message = String(text || "").trim();
        if (!message) return;

        try {
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(message);
            utterance.lang = "en-US";
            utterance.rate = 1;
            utterance.pitch = 1;

            window.speechSynthesis.speak(utterance);
        } catch (error) {
            console.warn("Speech output unavailable:", error);
        }
    }

    // =========================================================
    // CLOCK
    // =========================================================

    function formatTwo(value) {
        return String(value).padStart(2, "0");
    }

    function updateClock() {
        const now = new Date();

        const hours = now.getHours();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        const milliseconds = now.getMilliseconds();

        // Smooth analog hand movement.
        const secondAngle = (seconds + milliseconds / 1000) * 6;
        const minuteAngle = (minutes + seconds / 60) * 6;
        const hourAngle = ((hours % 12) + minutes / 60) * 30;

        // Preserve the CSS translateX(-50%) that centers the hands.
        if (hourHand) {
            hourHand.style.transform =
                `translateX(-50%) rotate(${hourAngle}deg)`;
        }

        if (minuteHand) {
            minuteHand.style.transform =
                `translateX(-50%) rotate(${minuteAngle}deg)`;
        }

        if (secondHand) {
            secondHand.style.transform =
                `translateX(-50%) rotate(${secondAngle}deg)`;
        }

        if (digitalTime) {
            let displayHour;

            if (is24Hour) {
                displayHour = hours;
            } else {
                displayHour = hours % 12 || 12;
            }

            digitalTime.textContent =
                `${formatTwo(displayHour)}:${formatTwo(minutes)}:${formatTwo(seconds)}`;
        }

        if (periodDisplay) {
            periodDisplay.textContent = hours >= 12 ? "PM" : "AM";
            periodDisplay.style.visibility = is24Hour ? "hidden" : "visible";
        }

        if (dateDisplay) {
            dateDisplay.textContent = now.toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric"
            });
        }

        checkAlarm(now);
    }

    // =========================================================
    // 12 / 24 HOUR FORMAT
    // =========================================================

    function toggleFormat() {
        is24Hour = !is24Hour;

        setStatus(
            is24Hour
                ? "24-hour format enabled."
                : "12-hour format enabled."
        );

        updateClock();
    }

    formatBtn?.addEventListener("click", toggleFormat);

    // =========================================================
    // ALARM
    // =========================================================

    function convertTo24Hour(hour, period) {
        let result = Number(hour);

        if (period === "PM" && result !== 12) {
            result += 12;
        }

        if (period === "AM" && result === 12) {
            result = 0;
        }

        return result;
    }

    function normalizeAlarmInputs() {
        let hour = Number(alarmHour?.value ?? 12);
        let minute = Number(alarmMinute?.value ?? 0);

        if (!Number.isFinite(hour)) hour = 12;
        if (!Number.isFinite(minute)) minute = 0;

        hour = Math.min(12, Math.max(1, Math.round(hour)));
        minute = Math.min(59, Math.max(0, Math.round(minute)));

        if (alarmHour) alarmHour.value = hour;
        if (alarmMinute) alarmMinute.value = formatTwo(minute);

        return { hour, minute };
    }

    function setAlarm() {
        ensureAudio();

        const { hour, minute } = normalizeAlarmInputs();
        const period = String(alarmPeriod?.value || "AM").toUpperCase();

        const hour24 = convertTo24Hour(hour, period);
        const now = new Date();

        const target = new Date(now);
        target.setHours(hour24, minute, 0, 0);

        // If this time has already passed today, schedule tomorrow.
        if (target <= now) {
            target.setDate(target.getDate() + 1);
        }

        alarmTarget = target;
        alarmActive = true;

        if (alarmStatus) {
            alarmStatus.textContent =
                `Alarm set for ${hour}:${formatTwo(minute)} ${period}`;
        }

        if (cancelAlarmBtn) {
            cancelAlarmBtn.hidden = false;
        }

        setStatus(`Alarm set for ${hour}:${formatTwo(minute)} ${period}.`);
        closeModal(alarmModal);
    }

    function cancelAlarm() {
        alarmTarget = null;
        alarmActive = false;

        if (alarmRingTimer) {
            clearTimeout(alarmRingTimer);
            alarmRingTimer = null;
        }

        stopAlarmSound();

        if (ringingOverlay) {
            ringingOverlay.classList.remove("active");
        }

        if (cancelAlarmBtn) {
            cancelAlarmBtn.hidden = true;
        }

        if (alarmStatus) {
            alarmStatus.textContent = "No alarm set";
        }

        setStatus("Alarm cancelled.");
    }

    function triggerAlarm() {
        if (!alarmActive) return;

        alarmActive = false;

        if (ringingOverlay) {
            ringingOverlay.classList.add("active");
        }

        setStatus("⏰ Alarm ringing!");

        startAlarmSound();
        speakResponse("Alarm ringing!");

        try {
            if (navigator.vibrate) {
                navigator.vibrate([500, 250, 500, 250, 500]);
            }
        } catch (error) {
            console.warn("Vibration unavailable:", error);
        }
    }

    function checkAlarm(now) {
        if (!alarmActive || !alarmTarget) return;

        if (now >= alarmTarget) {
            triggerAlarm();
        }
    }

    setAlarmBtn?.addEventListener("click", setAlarm);
    cancelAlarmBtn?.addEventListener("click", cancelAlarm);

    stopAlarmBtn?.addEventListener("click", () => {
        stopAlarmSound();

        if (ringingOverlay) {
            ringingOverlay.classList.remove("active");
        }

        setStatus("Alarm stopped.");

        try {
            if (navigator.vibrate) {
                navigator.vibrate(0);
            }
        } catch (_) {}
    });

    // =========================================================
    // STOPWATCH
    // =========================================================

    function formatStopwatch(ms) {
        const totalCentiseconds = Math.floor(ms / 10);
        const centiseconds = totalCentiseconds % 100;

        const totalSeconds = Math.floor(totalCentiseconds / 100);
        const seconds = totalSeconds % 60;

        const totalMinutes = Math.floor(totalSeconds / 60);
        const minutes = totalMinutes % 60;

        const hours = Math.floor(totalMinutes / 60);

        return (
            `${formatTwo(hours)}:` +
            `${formatTwo(minutes)}:` +
            `${formatTwo(seconds)}.` +
            `${formatTwo(centiseconds)}`
        );
    }

    function updateStopwatch() {
        if (!stopwatchRunning) return;

        stopwatchElapsed = Date.now() - stopwatchStart;

        if (stopwatchDisplay) {
            stopwatchDisplay.textContent =
                formatStopwatch(stopwatchElapsed);
        }
    }

    function toggleStopwatch() {
        if (stopwatchRunning) {
            stopwatchRunning = false;

            if (stopwatchTimer) {
                clearInterval(stopwatchTimer);
                stopwatchTimer = null;
            }

            updateStopwatch();
            setStatus("Stopwatch stopped.");
            return;
        }

        ensureAudio();

        stopwatchRunning = true;
        stopwatchStart = Date.now() - stopwatchElapsed;

        if (stopwatchTimer) {
            clearInterval(stopwatchTimer);
        }

        stopwatchTimer = setInterval(updateStopwatch, 10);
        setStatus("Stopwatch started.");
    }

    function resetStopwatch() {
        stopwatchRunning = false;

        if (stopwatchTimer) {
            clearInterval(stopwatchTimer);
            stopwatchTimer = null;
        }

        stopwatchElapsed = 0;

        if (stopwatchDisplay) {
            stopwatchDisplay.textContent = "00:00:00.00";
        }

        setStatus("Stopwatch reset.");
    }

    startStopwatchBtn?.addEventListener("click", toggleStopwatch);
    resetStopwatchBtn?.addEventListener("click", resetStopwatch);

    // =========================================================
    // TIMER
    // =========================================================

    function readTimerInputs() {
        const hours = Math.max(
            0,
            Number(timerHours?.value || 0)
        );

        const minutes = Math.max(
            0,
            Number(timerMinutes?.value || 0)
        );

        const seconds = Math.max(
            0,
            Number(timerSeconds?.value || 0)
        );

        return {
            hours: Math.floor(hours),
            minutes: Math.floor(minutes),
            seconds: Math.floor(seconds)
        };
    }

    function timerInputToMs() {
        const { hours, minutes, seconds } = readTimerInputs();

        return (
            hours * 3600000 +
            minutes * 60000 +
            seconds * 1000
        );
    }

    function formatTimer(ms) {
        const totalSeconds = Math.max(0, Math.ceil(ms / 1000));

        const seconds = totalSeconds % 60;
        const totalMinutes = Math.floor(totalSeconds / 60);
        const minutes = totalMinutes % 60;
        const hours = Math.floor(totalMinutes / 60);

        return (
            `${formatTwo(hours)}:` +
            `${formatTwo(minutes)}:` +
            `${formatTwo(seconds)}`
        );
    }

    function updateTimerDisplay() {
        if (timerDisplay) {
            timerDisplay.textContent = formatTimer(timerRemaining);
        }
    }

    function finishTimer() {
        timerRunning = false;

        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }

        timerRemaining = 0;
        updateTimerDisplay();

        setTimerStatus("Complete");
        setStatus("⏳ Timer finished!");

        if (timerCompleteOverlay) {
            timerCompleteOverlay.classList.add("active");
        }

        startTimerSound();
        speakResponse("Timer finished!");

        try {
            if (navigator.vibrate) {
                navigator.vibrate([500, 250, 500, 250, 500]);
            }
        } catch (error) {
            console.warn("Timer vibration unavailable:", error);
        }
    }

    function startTimer() {
        if (timerRunning) return;

        ensureAudio();

        const duration = timerInputToMs();

        if (duration <= 0) {
            setStatus("Please enter a timer duration.");
            setTimerStatus("Enter a duration");
            return;
        }

        timerRemaining = duration;
        timerEnd = Date.now() + duration;
        timerRunning = true;

        stopTimerSound();
        closeModal(timerCompleteOverlay);

        setTimerStatus("Running");
        updateTimerDisplay();

        if (timerInterval) {
            clearInterval(timerInterval);
        }

        timerInterval = setInterval(() => {
            timerRemaining = timerEnd - Date.now();

            if (timerRemaining <= 0) {
                finishTimer();
                return;
            }

            updateTimerDisplay();
        }, 100);

        setStatus("Timer started.");
    }

    function resetTimer() {
        timerRunning = false;

        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }

        stopTimerSound();

        timerRemaining = 0;
        timerEnd = 0;

        if (timerHours) timerHours.value = 0;
        if (timerMinutes) timerMinutes.value = 0;
        if (timerSeconds) timerSeconds.value = 0;

        updateTimerDisplay();
        setTimerStatus("Ready");
        setStatus("Timer reset.");
    }

    startTimerBtn?.addEventListener("click", startTimer);
    resetTimerBtn?.addEventListener("click", resetTimer);

    dismissTimerBtn?.addEventListener("click", () => {
        stopTimerSound();

        if (timerCompleteOverlay) {
            timerCompleteOverlay.classList.remove("active");
        }

        setTimerStatus("Ready");
        setStatus("Timer complete dismissed.");

        try {
            if (navigator.vibrate) {
                navigator.vibrate(0);
            }
        } catch (_) {}
    });

    timerCompleteOverlay?.addEventListener("click", (event) => {
        if (event.target === timerCompleteOverlay) {
            dismissTimerBtn?.click();
        }
    });

    // Enter in timer inputs starts the timer.
    [timerHours, timerMinutes, timerSeconds].forEach((input) => {
        input?.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                startTimer();
            }
        });
    });

    // =========================================================
    // LOCAL COMMAND PARSER
    // =========================================================

    const numberWords = {
        zero: 0,
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7,
        eight: 8,
        nine: 9,
        ten: 10,
        eleven: 11,
        twelve: 12,
        thirteen: 13,
        fourteen: 14,
        fifteen: 15,
        sixteen: 16,
        seventeen: 17,
        eighteen: 18,
        nineteen: 19,
        twenty: 20,
        thirty: 30,
        forty: 40,
        fifty: 50,
        sixty: 60
    };

    const numberPattern =
        "(\\d+|" +
        Object.keys(numberWords).join("|") +
        ")";

    function parseNumber(value) {
        if (/^\d+$/.test(value)) {
            return Number(value);
        }
        return numberWords[value.toLowerCase()] ?? 0;
    }

    function normalizeCommand(text) {
        return String(text || "")
            .trim()
            .replace(/\s+/g, " ");
    }

    function extractDuration(command) {
        const result = {
            hours: 0,
            minutes: 0,
            seconds: 0
        };

        let found = false;

        const hourMatch = command.match(
            new RegExp(`${numberPattern}\\s*(?:hour|hours|hr|hrs)\\b`, "i")
        );

        const minuteMatch = command.match(
            new RegExp(`${numberPattern}\\s*(?:minute|minutes|min|mins)\\b`, "i")
        );

        const secondMatch = command.match(
            new RegExp(`${numberPattern}\\s*(?:second|seconds|sec|secs)\\b`, "i")
        );

        if (hourMatch) {
            result.hours = parseNumber(hourMatch[1]);
            found = true;
        }

        if (minuteMatch) {
            result.minutes = parseNumber(minuteMatch[1]);
            found = true;
        }

        if (secondMatch) {
            result.seconds = parseNumber(secondMatch[1]);
            found = true;
        }

        return found ? result : null;
    }

    function parseAlarmCommand(command) {
        // Examples:
        // "set alarm for 7 pm"
        // "alarm at 7:30 am"
        // "wake me at 6 am"

        const match = command.match(
            /\b(?:set\s+)?(?:an?\s+)?alarm\b.*?\b(?:for|at)\s+(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)\b/i
        );

        if (!match) return null;

        const hour = Number(match[1]);
        const minute = Number(match[2] || 0);
        const period = match[3].toUpperCase();

        if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
            return null;
        }

        return {
            type: "action",
            action: "set_alarm",
            args: { hour, minute, period }
        };
    }

    function detectLocalCommand(text) {
        const command = normalizeCommand(text).toLowerCase();

        // Stop alarm
        if (
            command.includes("stop alarm") ||
            command.includes("cancel alarm")
        ) {
            return {
                type: "action",
                action: "cancel_alarm",
                args: {}
            };
        }

        // Alarm
        const alarmAction = parseAlarmCommand(command);
        if (alarmAction) return alarmAction;

        // Stopwatch
        if (
            command.includes("stopwatch") &&
            /\b(start|begin|resume|run)\b/i.test(command)
        ) {
            return {
                type: "action",
                action: "start_stopwatch",
                args: {}
            };
        }

        if (
            command.includes("stopwatch") &&
            /\b(stop|pause)\b/i.test(command)
        ) {
            return {
                type: "action",
                action: "stop_stopwatch",
                args: {}
            };
        }

        if (
            command.includes("stopwatch") &&
            /\b(reset|clear)\b/i.test(command)
        ) {
            return {
                type: "action",
                action: "reset_stopwatch",
                args: {}
            };
        }

        // Timer
        const duration = extractDuration(command);

        if (
            duration &&
            (
                command.includes("timer") ||
                command.startsWith("for ")
            )
        ) {
            return {
                type: "action",
                action: "set_timer",
                args: duration
            };
        }

        if (
            command.includes("timer") &&
            /\b(reset|clear|cancel)\b/i.test(command)
        ) {
            return {
                type: "action",
                action: "reset_timer",
                args: {}
            };
        }

        // Format
        if (
            /\b24\s*(hour|hours)\b/i.test(command) ||
            /\b24\s*hour\s*format\b/i.test(command)
        ) {
            return {
                type: "action",
                action: "set_format",
                args: { format: "24" }
            };
        }

        if (
            /\b12\s*(hour|hours)\b/i.test(command) ||
            /\b12\s*hour\s*format\b/i.test(command)
        ) {
            return {
                type: "action",
                action: "set_format",
                args: { format: "12" }
            };
        }

        if (
            command.includes("toggle") &&
            command.includes("format")
        ) {
            return {
                type: "action",
                action: "toggle_format",
                args: {}
            };
        }

        // Local time/date questions
        if (
            /\b(what is|what's|tell me|show me)?\s*(the\s*)?(current\s*)?time\b/i.test(command)
        ) {
            const now = new Date();
            const time = now.toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit"
            });

            return {
                type: "local_reply",
                reply: `The current time is ${time}.`
            };
        }

        if (
            /\b(what is|what's|tell me|show me)?\s*(today'?s\s*)?date\b/i.test(command)
        ) {
            const now = new Date();
            const date = now.toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric"
            });

            return {
                type: "local_reply",
                reply: `Today is ${date}.`
            };
        }

        return null;
    }

    // =========================================================
    // ACTION EXECUTOR
    // =========================================================

    async function executeAction(data) {
        if (!data || data.type !== "action") {
            return;
        }

        const action = data.action;
        const args = data.args || {};

        switch (action) {
            case "set_alarm": {
                const hour = Number(args.hour ?? 12);
                const minute = Number(args.minute ?? 0);
                const period = String(args.period ?? "AM").toUpperCase();

                if (alarmHour) alarmHour.value = hour;
                if (alarmMinute) alarmMinute.value = minute;
                if (alarmPeriod) alarmPeriod.value = period;

                setAlarm();

                const message =
                    `Alarm set for ${hour}:${formatTwo(minute)} ${period}.`;

                setStatus(message);
                speakResponse(message);
                return;
            }

            case "cancel_alarm":
                cancelAlarm();
                speakResponse("Alarm cancelled.");
                return;

            case "start_stopwatch":
                if (!stopwatchRunning) {
                    toggleStopwatch();
                }
                speakResponse("Stopwatch started.");
                return;

            case "stop_stopwatch":
                if (stopwatchRunning) {
                    toggleStopwatch();
                }
                speakResponse("Stopwatch stopped.");
                return;

            case "reset_stopwatch":
                resetStopwatch();
                speakResponse("Stopwatch reset.");
                return;

            case "set_timer": {
                const hours = Math.max(0, Number(args.hours ?? 0));
                const minutes = Math.max(0, Number(args.minutes ?? 0));
                const seconds = Math.max(0, Number(args.seconds ?? 0));

                if (timerHours) timerHours.value = Math.floor(hours);
                if (timerMinutes) timerMinutes.value = Math.floor(minutes);
                if (timerSeconds) timerSeconds.value = Math.floor(seconds);

                startTimer();

                const parts = [];
                if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
                if (minutes) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
                if (seconds) parts.push(`${seconds} second${seconds === 1 ? "" : "s"}`);

                const message =
                    `Timer started for ${parts.join(" ")}.`;

                setStatus(message);
                speakResponse(message);
                return;
            }

            case "reset_timer":
                resetTimer();
                speakResponse("Timer reset.");
                return;

            case "set_format": {
                const format = String(args.format || "");

                if (format === "24") {
                    is24Hour = true;
                } else if (format === "12") {
                    is24Hour = false;
                }

                updateClock();

                const message =
                    is24Hour
                        ? "24-hour format enabled."
                        : "12-hour format enabled.";

                setStatus(message);
                speakResponse(message);
                return;
            }

            case "toggle_format":
                toggleFormat();
                speakResponse(
                    is24Hour
                        ? "24-hour format enabled."
                        : "12-hour format enabled."
                );
                return;

            default:
                console.warn("Unknown KaalChakra action:", action);
        }
    }

    // =========================================================
    // AI BACKEND
    // =========================================================

    async function askKaalChakra(message) {
        const cleanMessage = normalizeCommand(message);

        if (!cleanMessage) {
            setStatus("Please say something.");
            return;
        }

        // Simple clock commands work even if the AI server is down.
        const localResult = detectLocalCommand(cleanMessage);

        if (localResult) {
            if (localResult.type === "action") {
                await executeAction(localResult);
                return;
            }

            if (localResult.type === "local_reply") {
                setStatus(localResult.reply);
                speakResponse(localResult.reply);
                return;
            }
        }

        // Everything else goes to the backend/Gemini.
        setStatus("Thinking...");

        try {
            const response = await fetch(
                "http://localhost:3000/api/ask",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        message: cleanMessage
                    })
                }
            );

            let data = null;

            try {
                data = await response.json();
            } catch {
                throw new Error(
                    "The AI server returned an invalid response."
                );
            }

            if (!response.ok) {
                throw new Error(
                    data?.error ||
                    data?.reply ||
                    `Server returned ${response.status}`
                );
            }

            await handleAIResponse(data);
        } catch (error) {
            console.error("KaalChakra AI error:", error);

            setStatus(
                "I couldn't connect to KaalChakra AI. Make sure the server is running on port 3000."
            );
        }
    }

    async function handleAIResponse(data) {
        if (!data) {
            setStatus("I didn't receive a response.");
            return;
        }

        if (data.type === "action") {
            await executeAction(data);
            return;
        }

        const reply =
            data.reply ??
            data.text ??
            data.message ??
            "I'm here. How can I help?";

        setStatus(reply);
        speakResponse(reply);
    }

    // =========================================================
    // VOICE RECOGNITION
    // =========================================================

    function setupRecognition() {
        if (!SpeechRecognition) {
            console.warn(
                "Speech recognition is not supported in this browser."
            );
            return;
        }

        recognition = new SpeechRecognition();

        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onstart = () => {
            recognitionBusy = true;

            setStatus("Listening...");

            voiceButton?.classList.add("listening");
        };

        recognition.onend = () => {
            recognitionBusy = false;

            voiceButton?.classList.remove("listening");
        };

        recognition.onerror = (event) => {
            recognitionBusy = false;

            voiceButton?.classList.remove("listening");

            console.error(
                "Speech recognition error:",
                event.error
            );

            if (event.error === "not-allowed") {
                setStatus(
                    "Microphone permission was denied."
                );
            } else if (event.error === "no-speech") {
                setStatus(
                    "I didn't hear anything. Please try again."
                );
            } else {
                setStatus(
                    "Could not hear you. Please try again."
                );
            }
        };

        recognition.onresult = async (event) => {
            const lastIndex = event.results.length - 1;

            let transcript =
                event.results[lastIndex][0].transcript.trim();

            if (!transcript) {
                setStatus("Please say something.");
                return;
            }

            console.log("You said:", transcript);

            // "for five seconds" -> local timer command
            if (
                !/\btimer\b/i.test(transcript) &&
                /\b(seconds?|minutes?|hours?)\b/i.test(transcript)
            ) {
                transcript = `Set a timer ${transcript}`;
            }

            await askKaalChakra(transcript);
        };
    }

    voiceButton?.addEventListener("click", () => {
        ensureAudio();

        if (!recognition) {
            setStatus(
                "Voice recognition is not supported in this browser."
            );
            return;
        }

        if (recognitionBusy) {
            try {
                recognition.stop();
            } catch (_) {}
            return;
        }

        try {
            recognition.start();
        } catch (error) {
            console.warn("Could not start recognition:", error);
            setStatus("Please try the microphone again.");
        }
    });

    setupRecognition();

    // =========================================================
    // PAGE VISIBILITY / CLEANUP
    // =========================================================

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            updateClock();
            updateStopwatch();
            updateTimerDisplay();
        }
    });

    window.addEventListener("beforeunload", () => {
        if (stopwatchTimer) clearInterval(stopwatchTimer);
        if (timerInterval) clearInterval(timerInterval);
        if (alarmRingTimer) clearTimeout(alarmRingTimer);
        stopAlarmSound();
        stopTimerSound();
    });

    // =========================================================
    // INITIALIZE
    // =========================================================

    updateClock();
    setInterval(updateClock, 200);
    updateTimerDisplay();

    if (stopwatchDisplay) {
        stopwatchDisplay.textContent =
            formatStopwatch(stopwatchElapsed);
    }

    setTimerStatus("Ready");
    setStatus("KaalChakra is ready.");

    console.log(
        "KaalChakra initialized. General AI endpoint: http://localhost:3000/api/ask"
    );
})();
