import { useNavigate } from 'react-router-dom';
import { CosmicBackground } from '../../components/ui/CosmicBackground';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { ProfileForm } from './ProfileForm';

export function ProfileSetupScreen() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-14">
      <CosmicBackground />
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>

      <div className="mb-8 text-center">
        <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-accent">Step 02 · Set up your profile</p>
        <h1 className="text-2xl font-extrabold tracking-tight">Tell Gandalf a bit about yourself</h1>
        <p className="mt-2 max-w-md text-[14.5px] text-text-muted">
          This shapes which topics get recommended and how examples are framed — you can change any of it later from Settings.
        </p>
      </div>

      <ProfileForm onSaved={() => navigate('/dashboard')} />
    </div>
  );
}
