import { render, screen } from '@testing-library/react';
import App from './App';

// Mock navigator.mediaDevices.getUserMedia
navigator.mediaDevices = {
  getUserMedia: () => Promise.resolve({}),
};

// Mock simple-peer
jest.mock('simple-peer', () => {
  return jest.fn().mockImplementation(() => {
    return {
      on: jest.fn(),
      signal: jest.fn(),
      destroy: jest.fn(),
    };
  });
});

// Mock window.prompt
window.prompt = jest.fn();

test('renders Verdi Live heading', () => {
  render(<App />);
  const headingElement = screen.getByText(/Verdi Live/i);
  expect(headingElement).toBeInTheDocument();
});
