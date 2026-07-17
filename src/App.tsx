import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import { ProfileProvider } from './lib/ProfileContext';
import { ProviderBadgeProvider } from './lib/ProviderBadgeContext';
import { ToastProvider } from './lib/ToastContext';
import { PageTitleProvider } from './lib/PageTitleContext';
import { RequireSession } from './components/RequireSession';
import { RequireOnboarded } from './components/RequireOnboarded';
import { AppShell } from './components/layout/AppShell';

import { AuthScreen } from './screens/Auth/AuthScreen';
import { ProfileSetupScreen } from './screens/Profile/ProfileSetupScreen';
import { DashboardHome } from './screens/Dashboard/DashboardHome';
import { JourneyDetail } from './screens/Dashboard/JourneyDetail';
import { QuizRunner } from './screens/Quiz/QuizRunner';
import { LearningScreen } from './screens/Learning/LearningScreen';
import { TimedTestPicker } from './screens/TimedTest/TimedTestPicker';
import { AdaptiveQuizScreen } from './screens/AdaptiveQuiz/AdaptiveQuizScreen';
import { SettingsScreen } from './screens/Settings/SettingsScreen';
import { HistoryScreen } from './screens/History/HistoryScreen';
import { SessionReviewScreen } from './screens/History/SessionReviewScreen';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProfileProvider>
          <ProviderBadgeProvider>
           <ToastProvider>
            <PageTitleProvider>
            <Routes>
              <Route path="/auth" element={<AuthScreen />} />

              <Route element={<RequireSession />}>
                <Route path="/onboarding" element={<ProfileSetupScreen />} />

                <Route element={<RequireOnboarded />}>
                  <Route element={<AppShell />}>
                    <Route path="/dashboard" element={<DashboardHome />} />
                    <Route path="/journeys/:journeyId" element={<JourneyDetail />} />
                    <Route path="/journeys/:journeyId/quiz/:sessionId" element={<QuizRunner />} />
                    <Route path="/journeys/:journeyId/learning" element={<LearningScreen />} />
                    <Route path="/timed-test" element={<TimedTestPicker />} />
                    <Route path="/timed-test/:sessionId" element={<QuizRunner />} />
                    <Route path="/adaptive-quiz" element={<AdaptiveQuizScreen />} />
                    <Route path="/adaptive-quiz/:sessionId" element={<QuizRunner />} />
                    <Route path="/history" element={<HistoryScreen />} />
                    <Route path="/history/:sessionId" element={<SessionReviewScreen />} />
                    <Route path="/settings" element={<SettingsScreen />} />
                  </Route>
                </Route>
              </Route>

              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            </PageTitleProvider>
           </ToastProvider>
          </ProviderBadgeProvider>
        </ProfileProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
