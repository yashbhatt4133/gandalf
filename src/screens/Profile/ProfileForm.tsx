import { useEffect, useRef, useState } from 'react';
import { ChipSelect } from '../../components/ui/ChipSelect';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../lib/AuthContext';
import { useProfile } from '../../lib/ProfileContext';
import { useToast } from '../../lib/ToastContext';
import { addInterest, getInterests, removeInterest, upsertProfile } from '../../lib/profile';
import { parseCv } from '../../lib/api';
import type { ExperienceLevel, TargetRole, UserInterest } from '../../types/db';

const TARGET_ROLES: TargetRole[] = ['Software Engineer', 'AI Engineer', 'ML Engineer', 'Data Scientist', 'Other'];
const EXPERIENCE_LEVELS: ExperienceLevel[] = ['Student', 'Fresher', '1-3 YOE', '3+ YOE', 'Other'];
const INTEREST_SUGGESTIONS = ['Chess', 'Gaming', 'Movies', 'Football', 'Cricket', 'Music', 'Reading', 'Travel', 'Cooking', 'Art'];

export function ProfileForm({ onSaved }: { onSaved?: () => void }) {
  const { session } = useAuth();
  const { profile, refresh } = useProfile();
  const { show: showToast } = useToast();
  const userId = session!.user.id;

  const [displayName, setDisplayName] = useState('');
  const [targetRole, setTargetRole] = useState<string | null>(null);
  const [targetRoleOther, setTargetRoleOther] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<string | null>(null);
  const [experienceLevelOther, setExperienceLevelOther] = useState('');
  const [resumeMode, setResumeMode] = useState<'cv' | 'manual'>('manual');
  const [resumeText, setResumeText] = useState('');
  const [interestsOpen, setInterestsOpen] = useState(false);
  const [interests, setInterests] = useState<UserInterest[]>([]);
  const [interestInput, setInterestInput] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '');
      if (profile.target_role && !TARGET_ROLES.includes(profile.target_role as TargetRole)) {
        setTargetRole('Other');
        setTargetRoleOther(profile.target_role);
      } else {
        setTargetRole(profile.target_role);
      }
      if (profile.experience_level && !EXPERIENCE_LEVELS.includes(profile.experience_level as ExperienceLevel)) {
        setExperienceLevel('Other');
        setExperienceLevelOther(profile.experience_level);
      } else {
        setExperienceLevel(profile.experience_level);
      }
      setResumeMode(profile.resume_source === 'cv' ? 'cv' : 'manual');
      setResumeText(profile.resume_raw_text ?? '');
    }
    getInterests(userId).then(setInterests);
  }, [profile, userId]);

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    try {
      const { extractResumeText } = await import('../../lib/pdf');
      const text = await extractResumeText(file);
      setResumeText(text);
      setResumeMode('cv');
    } catch {
      setError('Could not read that file — try pasting your background as text instead.');
    }
  }

  async function handleAddInterest(label: string) {
    const clean = label.trim();
    if (!clean || interests.some((i) => i.label === clean)) return;
    const row = await addInterest(userId, clean);
    setInterests((prev) => [...prev, row]);
    setInterestInput('');
  }

  async function handleRemoveInterest(id: string) {
    await removeInterest(id);
    setInterests((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSavedMsg(false);
    try {
      const resolvedRole = targetRole === 'Other' ? targetRoleOther || 'Other' : targetRole;
      const resolvedLevel = experienceLevel === 'Other' ? experienceLevelOther || 'Other' : experienceLevel;

      let parsedSkills: Record<string, unknown> | null = profile?.parsed_skills ?? null;
      if (resumeText.trim()) {
        try {
          const res = await parseCv(resumeText);
          parsedSkills = res.parsedSkills;
        } catch {
          // Non-fatal — the profile still saves without extracted skills.
        }
      }

      await upsertProfile(userId, {
        display_name: displayName || null,
        target_role: (resolvedRole as TargetRole) || null,
        experience_level: (resolvedLevel as ExperienceLevel) || null,
        resume_source: resumeText.trim() ? resumeMode : null,
        resume_raw_text: resumeText.trim() || null,
        parsed_skills: parsedSkills,
      });
      refresh();
      setSavedMsg(true);
      showToast('Profile saved');
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-[640px]">
      <div className="flex flex-col gap-6">
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-text-muted">
          Display name <span className="text-text-dim">(shown everywhere instead of your email)</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Yash"
            className="rounded-[10px] border border-border bg-panel px-3.5 py-2.5 text-[14px] text-text outline-none focus:border-accent"
          />
        </label>

        <div>
          <div className="mb-2 text-[13px] font-semibold text-text-muted">Target role</div>
          <ChipSelect options={TARGET_ROLES} value={targetRole} onChange={setTargetRole} />
          {targetRole === 'Other' && (
            <input
              value={targetRoleOther}
              onChange={(e) => setTargetRoleOther(e.target.value)}
              placeholder="Your target role"
              className="mt-2 w-full rounded-[10px] border border-border bg-panel px-3.5 py-2.5 text-[14px] text-text outline-none focus:border-accent"
            />
          )}
        </div>

        <div>
          <div className="mb-2 text-[13px] font-semibold text-text-muted">Experience level</div>
          <ChipSelect options={EXPERIENCE_LEVELS} value={experienceLevel} onChange={setExperienceLevel} />
          {experienceLevel === 'Other' && (
            <input
              value={experienceLevelOther}
              onChange={(e) => setExperienceLevelOther(e.target.value)}
              placeholder="Your experience level"
              className="mt-2 w-full rounded-[10px] border border-border bg-panel px-3.5 py-2.5 text-[14px] text-text outline-none focus:border-accent"
            />
          )}
        </div>

        <div>
          <div className="mb-2 text-[13px] font-semibold text-text-muted">Resume / background</div>
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="rounded-[10px] border border-border px-3.5 py-2 text-[13px] font-semibold text-text hover:bg-panel-2"
            >
              Upload PDF/txt
            </button>
            {fileName && <span className="self-center text-[12.5px] text-text-muted">{fileName}</span>}
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.txt"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
          <textarea
            value={resumeText}
            onChange={(e) => {
              setResumeText(e.target.value);
              setResumeMode('manual');
            }}
            rows={5}
            placeholder="Or paste/describe your background here — years of experience, tech stack, what you're prepping for…"
            className="w-full resize-y rounded-[10px] border border-border bg-panel px-3.5 py-2.5 text-[13.5px] text-text outline-none focus:border-accent"
          />
        </div>

        <div>
          <button
            type="button"
            onClick={() => setInterestsOpen((v) => !v)}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-text-muted"
          >
            {interestsOpen ? '▾' : '▸'} Interests <span className="font-normal text-text-dim">(optional — personalizes analogies)</span>
          </button>
          {interestsOpen && (
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {interests.map((i) => (
                  <span key={i.id} className="chip" style={{ background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }}>
                    {i.label}
                    <button type="button" onClick={() => handleRemoveInterest(i.id)} className="ml-1 text-white/70 hover:text-white">
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {INTEREST_SUGGESTIONS.filter((s) => !interests.some((i) => i.label === s)).map((s) => (
                  <button key={s} type="button" onClick={() => handleAddInterest(s)} className="chip" style={{ cursor: 'pointer' }}>
                    + {s}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={interestInput}
                  onChange={(e) => setInterestInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddInterest(interestInput))}
                  placeholder="Add your own…"
                  className="flex-1 rounded-[10px] border border-border bg-panel px-3.5 py-2 text-[13.5px] text-text outline-none focus:border-accent"
                />
                <Button type="button" variant="ghost" onClick={() => handleAddInterest(interestInput)}>
                  Add
                </Button>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-[13px] text-danger">{error}</p>}
        {savedMsg && <p className="text-[13px] text-good">Saved.</p>}

        <Button onClick={handleSave} disabled={saving || !targetRole || !experienceLevel}>
          {saving ? 'Saving…' : 'Save profile'}
        </Button>
      </div>
    </Card>
  );
}
