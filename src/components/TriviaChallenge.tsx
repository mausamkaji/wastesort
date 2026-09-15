import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, CheckCircle2, XCircle, ArrowRight, Sparkles, Loader2, Lightbulb } from 'lucide-react';
import { TRIVIA_QUESTIONS } from '../data/trivia';
import { TriviaQuestion } from '../types';
import { useGame } from '../context/GameContext';

export const TriviaChallenge: React.FC = () => {
  const { recordTriviaAnswer } = useGame();
  const [questions, setQuestions] = useState<TriviaQuestion[]>(TRIVIA_QUESTIONS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const currentQuestion = questions[currentIndex % questions.length];

  const handleSelectOption = (idx: number) => {
    if (isAnswered) return;

    setSelectedOption(idx);
    setIsAnswered(true);
    const isCorrect = idx === currentQuestion.correctIndex;
    recordTriviaAnswer(isCorrect);
  };

  const handleNext = () => {
    setSelectedOption(null);
    setIsAnswered(false);
    setCurrentIndex(prev => (prev + 1) % questions.length);
  };

  const handleGenerateAiTrivia = async () => {
    setIsLoadingAi(true);
    setAiError(null);
    try {
      const res = await fetch('/api/generate-trivia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'circular economy and recycling myths' }),
      });
      if (!res.ok) throw new Error('Failed to generate trivia');
      const data: TriviaQuestion = await res.json();
      
      if (!data || !data.question || !Array.isArray(data.options) || data.options.length < 2) {
        throw new Error('Invalid trivia format received');
      }

      const newQuestion: TriviaQuestion = {
        id: `ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        question: data.question,
        options: data.options,
        correctIndex: typeof data.correctIndex === 'number' && data.correctIndex >= 0 && data.correctIndex < data.options.length ? data.correctIndex : 0,
        explanation: data.explanation || 'Refer to circular economy and recycling guidelines.',
        ecoFact: data.ecoFact || 'Check local guidelines for specific municipal sorting rules.',
        difficulty: data.difficulty || 'medium',
      };

      setQuestions(prev => {
        // Prevent exact duplicate questions
        const filtered = prev.filter(q => q.question.toLowerCase().trim() !== newQuestion.question.toLowerCase().trim());
        return [newQuestion, ...filtered];
      });
      setCurrentIndex(0);
      setSelectedOption(null);
      setIsAnswered(false);
    } catch {
      setAiError('Could not reach AI trivia service. Showing question from verified catalog.');
    } finally {
      setIsLoadingAi(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-100 text-indigo-800 rounded-lg text-lg">🧠</span>
            <h2 className="text-xl font-extrabold text-stone-900">
              Recycle IQ Trivia & Mythbusters
            </h2>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Test your knowledge against common misconceptions and learn the science behind waste management.
          </p>
        </div>

        <button
          id="btn-generate-ai-trivia"
          onClick={handleGenerateAiTrivia}
          disabled={isLoadingAi}
          className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3.5 py-2 rounded-xl transition-all cursor-pointer disabled:opacity-50"
        >
          {isLoadingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-indigo-600" />}
          <span>Generate AI Question</span>
        </button>
      </div>

      {aiError && (
        <div className="bg-amber-50 text-amber-900 text-xs p-3 rounded-xl border border-amber-200">
          {aiError}
        </div>
      )}

      {/* Question Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="bg-white border-2 border-stone-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6"
        >
          {/* Metadata tag */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500">
              Question #{currentIndex + 1} of {questions.length}
            </span>
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
              currentQuestion.difficulty === 'hard'
                ? 'bg-rose-100 text-rose-800'
                : currentQuestion.difficulty === 'medium'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-100 text-emerald-800'
            }`}>
              {currentQuestion.difficulty}
            </span>
          </div>

          {/* Question Text */}
          <h3 className="text-lg sm:text-xl font-extrabold text-stone-900 leading-snug">
            {currentQuestion.question}
          </h3>

          {/* Options Grid */}
          <div className="space-y-3">
            {currentQuestion.options.map((option, idx) => {
              const isSelected = selectedOption === idx;
              const isCorrect = idx === currentQuestion.correctIndex;

              let buttonStyle = 'bg-stone-50 border-stone-200 hover:border-indigo-400 text-stone-800';

              if (isAnswered) {
                if (isCorrect) {
                  buttonStyle = 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold';
                } else if (isSelected) {
                  buttonStyle = 'bg-rose-50 border-rose-500 text-rose-950';
                } else {
                  buttonStyle = 'bg-stone-50/60 border-stone-200 text-stone-400 opacity-60';
                }
              }

              return (
                <button
                  key={idx}
                  id={`trivia-opt-${idx}`}
                  disabled={isAnswered}
                  onClick={() => handleSelectOption(idx)}
                  className={`w-full p-4 rounded-2xl border-2 text-left text-xs sm:text-sm transition-all flex items-start gap-3 cursor-pointer ${buttonStyle}`}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    isAnswered && isCorrect
                      ? 'bg-emerald-600 text-white'
                      : isAnswered && isSelected
                      ? 'bg-rose-600 text-white'
                      : 'bg-stone-200 text-stone-700'
                  }`}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="flex-1 leading-relaxed">{option}</span>
                  {isAnswered && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
                  {isAnswered && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
                </button>
              );
            })}
          </div>

          {/* Explanation Panel */}
          {isAnswered && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-indigo-950 space-y-3"
            >
              <div className="flex items-start gap-2.5">
                <Lightbulb className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-extrabold text-sm text-indigo-900">
                    {selectedOption === currentQuestion.correctIndex ? 'Correct! Here is why:' : 'Misconception Cleared:'}
                  </h4>
                  <p className="text-xs sm:text-sm text-stone-700 mt-1 leading-relaxed">
                    {currentQuestion.explanation}
                  </p>
                </div>
              </div>

              {currentQuestion.ecoFact && (
                <div className="text-xs font-semibold text-indigo-900 bg-white/70 p-3 rounded-xl border border-indigo-200/60">
                  <span className="font-bold">🌱 Eco-Action Tip: </span>
                  {currentQuestion.ecoFact}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  id="btn-next-trivia-question"
                  onClick={handleNext}
                  className="flex items-center gap-2 bg-stone-900 hover:bg-black text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  <span>Next Question</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
