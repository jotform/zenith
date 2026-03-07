const { ProgressBar, createBuildProgressBar, getBuildProgressBar, clearBuildProgressBar } = require('../build/utils/progressBar');

describe('ProgressBar', () => {
  let progressBar;

  beforeEach(() => {
    progressBar = new ProgressBar({ total: 10, label: 'Test Progress' });
  });

  afterEach(() => {
    if (progressBar) {
      try {
        progressBar.stop();
      } catch (e) {
        // Progress bar may already be stopped
      }
    }
    clearBuildProgressBar();
  });

  describe('constructor', () => {
    it('should create a progress bar with the given options', () => {
      expect(progressBar).toBeDefined();
    });

    it('should be enabled by default', () => {
      expect(progressBar.isEnabled()).toBe(true);
    });
  });

  describe('disable', () => {
    it('should disable the progress bar', () => {
      progressBar.disable();
      expect(progressBar.isEnabled()).toBe(false);
    });
  });

  describe('start', () => {
    it('should start the progress bar when enabled', () => {
      expect(() => progressBar.start()).not.toThrow();
    });

    it('should not throw when disabled', () => {
      progressBar.disable();
      expect(() => progressBar.start()).not.toThrow();
    });
  });

  describe('increment', () => {
    it('should increment when enabled', () => {
      progressBar.start();
      expect(() => progressBar.increment()).not.toThrow();
    });

    it('should do nothing when disabled', () => {
      progressBar.disable();
      progressBar.start();
      expect(() => progressBar.increment()).not.toThrow();
    });
  });

  describe('update', () => {
    it('should update the current value when enabled', () => {
      progressBar.start();
      expect(() => progressBar.update(5)).not.toThrow();
    });

    it('should do nothing when disabled', () => {
      progressBar.disable();
      progressBar.start();
      expect(() => progressBar.update(5)).not.toThrow();
    });
  });

  describe('stop', () => {
    it('should stop the progress bar', () => {
      progressBar.start();
      expect(() => progressBar.stop()).not.toThrow();
    });
  });
});

describe('Global progress bar functions', () => {
  afterEach(() => {
    const bar = getBuildProgressBar();
    if (bar) {
      try {
        bar.stop();
      } catch (e) {
        // Progress bar may already be stopped
      }
    }
    clearBuildProgressBar();
  });

  describe('createBuildProgressBar', () => {
    it('should create a new progress bar and store it globally', () => {
      const bar = createBuildProgressBar(20, 'Build Test');
      expect(bar).toBeDefined();
      expect(bar.isEnabled()).toBe(true);
    });

    it('should be retrievable via getBuildProgressBar', () => {
      const created = createBuildProgressBar(15, 'Retrieve Test');
      const retrieved = getBuildProgressBar();
      expect(retrieved).toBe(created);
    });
  });

  describe('clearBuildProgressBar', () => {
    it('should clear the global progress bar instance', () => {
      createBuildProgressBar(10, 'Clear Test');
      expect(getBuildProgressBar()).toBeDefined();
      clearBuildProgressBar();
      expect(getBuildProgressBar()).toBeNull();
    });
  });

  describe('getBuildProgressBar', () => {
    it('should return null when no progress bar is created', () => {
      clearBuildProgressBar();
      expect(getBuildProgressBar()).toBeNull();
    });
  });
});
