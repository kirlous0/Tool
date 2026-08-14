import React, { useState } from 'react';
import {
  HelpCircle,
  Key,
  ShieldAlert,
  FolderGit2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileArchive,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from 'lucide-react';

interface TroubleshootingGuideProps {
  hasTokenScopeWarning?: boolean;
  defaultExpanded?: boolean;
}

export const TroubleshootingGuide: React.FC<TroubleshootingGuideProps> = ({
  hasTokenScopeWarning = false,
  defaultExpanded = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultExpanded || hasTokenScopeWarning);
  const [activeTab, setActiveTab] = useState<'ar' | 'en'>('ar');

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl transition-all">
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-800 text-cyan-400">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              {activeTab === 'ar' ? 'دليل حل مشاكل الرفع إلى GitHub' : 'GitHub Upload Troubleshooting Guide'}
              {hasTokenScopeWarning && (
                <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-800 text-[10px] font-semibold animate-pulse">
                  ⚠ تنبيه الصلاحيات
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeTab === 'ar'
                ? 'أهم أسباب فشل الرفع وكيفية إصلاحها بدقائق'
                : 'Common upload failures and how to resolve them in minutes'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Language Switcher */}
          <div
            className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveTab('ar')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                activeTab === 'ar' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              عربي
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('en')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                activeTab === 'en' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              English
            </button>
          </div>

          <button
            type="button"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="mt-5 pt-4 border-t border-slate-800 space-y-4 text-xs">
          {/* One-Click Token Generator Quick Action */}
          <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-800 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2.5 text-cyan-200">
              <Key className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                {activeTab === 'ar'
                  ? 'إنشاء رمز جديد بالصلاحيات الصحيحة بضغطة واحدة:'
                  : 'Generate a new token with pre-selected scopes:'}
              </span>
            </div>
            <a
              href="https://github.com/settings/tokens/new?scopes=repo&description=ZipToGitHub"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition flex items-center gap-1.5 shadow-md shadow-cyan-950/30"
            >
              <span>{activeTab === 'ar' ? 'إنشاء رمز GitHub جاهز' : 'Create Pre-Configured Token'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {activeTab === 'ar' ? (
            /* Arabic Content */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" dir="rtl">
              {/* Problem 1 */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="font-bold text-amber-400 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>1. نقص صلاحية `repo` في الرمز (PAT)</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  السبب الأكثر شيوعاً هو استخدام رمز وصول لا يحتوي على إذن <strong>repo</strong>. بدون هذا الإذن يرفض GitHub إنشاء المستودع أو حفظ الملفات.
                </p>
                <div className="text-cyan-400 font-mono text-[10px] bg-slate-900 p-2 rounded border border-slate-800">
                  الحل: اضغط على زر إنشاء رمز أعلاه وتأكد من تفعيل خانة <strong>repo (Full control of private repositories)</strong>.
                </div>
              </div>

              {/* Problem 2 */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="font-bold text-sky-400 flex items-center gap-2">
                  <FolderGit2 className="w-4 h-4 shrink-0" />
                  <span>2. اسم المستودع موجود مسبقاً على GitHub</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  إذا كان لديك مستودع قديم بنفس الاسم، ستظهر رسالة <em>Name already exists (422)</em>.
                </p>
                <div className="text-cyan-400 font-mono text-[10px] bg-slate-900 p-2 rounded border border-slate-800">
                  الحل: قم بتغيير اسم المستودع في خانة الإعدادات، أو اختر وضع <strong>"تحديث مستودع موجود"</strong>.
                </div>
              </div>

              {/* Problem 3 */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="font-bold text-indigo-400 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 shrink-0" />
                  <span>3. حدود طلبات GitHub (Rate Limiting)</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  عند رفع مجلد يحتوي على عشرات الملفات دفعة واحدة، قد يفرض GitHub قيود سرعة مؤقتة (Secondary Rate Limits).
                </p>
                <div className="text-cyan-400 font-mono text-[10px] bg-slate-900 p-2 rounded border border-slate-800">
                  الحل: تم تزويد التطبيق بنظام إعادة محاولة ذكي وتلقائي مع تأخير تصاعدي لتخطي هذا الحد بأمان.
                </div>
              </div>

              {/* Problem 4 */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="font-bold text-emerald-400 flex items-center gap-2">
                  <FileArchive className="w-4 h-4 shrink-0" />
                  <span>4. مجلدات غير ضرورية (node_modules أو Build)</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  رفع آلاف الملفات المؤقتة قد يعطل الاتصال.
                </p>
                <div className="text-cyan-400 font-mono text-[10px] bg-slate-900 p-2 rounded border border-slate-800">
                  الحل: استبعاد مجلدات <code>node_modules</code> و <code>dist</code> و <code>.next</code> في خطوة مراجعة الملفات.
                </div>
              </div>
            </div>
          ) : (
            /* English Content */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Problem 1 */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="font-bold text-amber-400 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>1. Missing `repo` Scope on Token</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  The most common reason for failed uploads is a token generated without the <strong>repo</strong> scope. Without it, GitHub rejects creating repositories and uploading blobs.
                </p>
                <div className="text-cyan-400 font-mono text-[10px] bg-slate-900 p-2 rounded border border-slate-800">
                  Fix: Click the button above to generate a token with <strong>repo (Full control of private repositories)</strong> pre-checked.
                </div>
              </div>

              {/* Problem 2 */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="font-bold text-sky-400 flex items-center gap-2">
                  <FolderGit2 className="w-4 h-4 shrink-0" />
                  <span>2. Repository Name Conflict</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  If a repository with the exact same name already exists in your account, GitHub returns <em>Name already exists (422)</em>.
                </p>
                <div className="text-cyan-400 font-mono text-[10px] bg-slate-900 p-2 rounded border border-slate-800">
                  Fix: Choose a new name or switch to <strong>"Update Existing Repository"</strong> mode on the home screen.
                </div>
              </div>

              {/* Problem 3 */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="font-bold text-indigo-400 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 shrink-0" />
                  <span>3. GitHub API Secondary Rate Limits</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Creating rapid sequential Git Blobs can trigger GitHub rate throttling.
                </p>
                <div className="text-cyan-400 font-mono text-[10px] bg-slate-900 p-2 rounded border border-slate-800">
                  Fix: The app now uses exponential backoff retries and concurrency throttling to handle this automatically.
                </div>
              </div>

              {/* Problem 4 */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="font-bold text-emerald-400 flex items-center gap-2">
                  <FileArchive className="w-4 h-4 shrink-0" />
                  <span>4. Unnecessary Build / Dependency Folders</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Uploading thousands of generated files (like <code>node_modules</code>) wastes API quotas and causes timeouts.
                </p>
                <div className="text-cyan-400 font-mono text-[10px] bg-slate-900 p-2 rounded border border-slate-800">
                  Fix: Keep recommended exclusions checked during the File Review step.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
