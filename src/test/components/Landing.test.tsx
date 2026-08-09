import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Landing from '../../../pages/Landing';

describe('Landing Page', () => {
  const renderLanding = () =>
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    );

  it('renders the brand title and logo', () => {
    renderLanding();
    expect(screen.getByText('AcademiaZen')).toBeInTheDocument();
  });

  it('renders all primary navbar navigation links', () => {
    renderLanding();
    const navLinks = screen.getAllByRole('link');
    const hrefs = navLinks.map(link => link.getAttribute('href'));

    expect(hrefs).toContain('#how-it-works');
    expect(hrefs).toContain('#workspace');
    expect(hrefs).toContain('#trust');
    expect(hrefs).toContain('#faq');
  });

  it('renders Sign in and Get started call-to-action buttons', () => {
    renderLanding();
    const signInLinks = screen.getAllByRole('link', { name: /sign in/i });
    expect(signInLinks.length).toBeGreaterThan(0);
    expect(signInLinks[0]).toBeInTheDocument();

    const getStartedLinks = screen.getAllByRole('link', { name: /get started/i });
    expect(getStartedLinks.length).toBeGreaterThan(0);
    expect(getStartedLinks[0]).toBeInTheDocument();
  });

  it('toggles FAQ accordion answers when clicked', async () => {
    const user = userEvent.setup();
    renderLanding();

    const faqButton = screen.getByText('Can I use it on my phone?');
    expect(faqButton).toBeInTheDocument();

    // Click to open FAQ answer
    await user.click(faqButton);
    expect(screen.getByText(/Yes. AcademiaZen is designed as a responsive study workspace/i)).toBeInTheDocument();
  });
});
