'use babel';
const os = require('os');
const fs = require('fs');
const path = require('path');
const which = require('which');
const anylint = require('anylint');
const rc = require('rc');
const JSON5 = require('json5');

const parseErrors = (output, filePath) => {
  return output.map(m => ({
    type: (m.severity === 2 ? 'error' : 'warn'),
    text: m.message,
    filePath: filePath,
    range: [
      [m.line - 1, m.column - 1],
      [m.line, m.column],
    ],
  }));
};

export default {
  config: {
    languages: {
      title: 'Languages',
      description: 'RegExp pattern to activate linter-anylint.',
      type: 'string',
      default: '*',
      order: 1,
    },
    anylintrcPath: {
      title: 'Path of .anylintrc',
      description: 'By default, .anylintrc in the root of the project is used.',
      type: 'string',
      default: '',
      order: 2,
    },
  },

  settings: {},
  settingsPath: '',
  pattern: '*',

  activate() {
    require('atom-package-deps').install('linter-anylint');

    const { CompositeDisposable } = require('atom');
    const { MessagePanelView } = require('atom-message-panel');
    const { PlainMessageView } = require('atom-message-panel');

    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(atom.config.observe('linter-anylint.anylintrcPath', (p) => this.loadRc(p)));
    this.subscriptions.add(atom.config.observe('linter-anylint.languages', (pattern) => {
      this.pattern = pattern || '*';
    }));
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  loadRc(anylintrcPath) {
    this.settings = {};

    if (fs.existsSync(anylintrcPath) && fs.statSync(anylintrcPath).isFile()) {
      try {
        const json = fs.readFileSync(anylintrcPath, fs.X_OK);
        this.settings = JSON5.parse(json);
        this.settingsPath = anylintrcPath;
      } catch (error) {
        console.log(error);
      }
    } else {
      try {
        this.settings = rc('anylint', null, null, JSON5.parse)
        this.settingsPath = this.settings.configs[0];
      } catch (error) {
        console.log(error);
      }
    }

    if (this.settings) {
      if (this.messages) {
        this.messages.close();
        this.messages = undefined;
      }
    } else {
      if (!this.messages) {
        this.messages = new MessagePanelView({
          title: 'linter-anylintrc',
        });
        this.messages.attach();
        this.messages.toggle();
      }
      this.messages.clear();
      this.messages.add(new PlainMessageView({
        message: `Unable to locate .anylintrc at '${anylintrcPath}', project root, and $HOME.`,
        className: 'text-error',
      }));
    }
  },

  provideLinter() {
    return {
      name: 'anylint',
      scope: 'file',
      grammarScopes: ['*'],
      lintOnFly: true,
      lint: (activeEditor) => {
        const file = activeEditor.getPath();
        const content = activeEditor.getText();

        return anylint.lintText(content, file, this.settings, this.settingsPath)
          .then(output => {
            return parseErrors(output, file);
          })
          .catch((error) => {
            console.error(error);
            return null;
          });
      },
    };
  },
};
