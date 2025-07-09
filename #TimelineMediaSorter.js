const fs = require('fs');
const path = require('path');
const util = require('util');

const rootPath = __dirname;

class TimelineMediaSorterSettings {
  /**
   * Enables or disables saving logs during the media sorting process.
   * Set to `true` to keep logs, or `false` to disable logging.
   */
  static SAVE_LOGS = true;

  /**
   * This object defines a list of user-defined events with optional date ranges
   * in "DD.MM.YYYY" format.
   *
   * Each entry is a string in the format:
   *    "FolderPath|Event Name: startDate-endDate"
   *
   * - FolderPath (optional) allows nesting events into subfolders, using "|" as a separator.
   * - startDate and endDate must be in "DD.MM.YYYY" format.
   * - If endDate is omitted, it is considered a one-day event.
   * - If the endDate is before the startDate (e.g., 31.12.x - 01.01.x),
   *   the event is treated as crossing the new year boundary.
   * - The year (YYYY) may be:
   *     - A 4-digit number (e.g. 2017)
   *     - "x" (lowercase) to indicate that the event is recurring annually
   *       and should be matched for any year.
   *
   * Examples:
   * [
   *   'New Year: 31.12.x-01.01.x',       // Recurring event that starts on Dec 31 and ends on Jan 1, crossing into the new year
   *   'Christmas: 24.12.x-26.12.x',      // Recurring 3-day event
   *   'Birthdays|My Birthday: 02.01.x',  // Recurring single-day event
   *   'Weddings|My Wedding: 01.02.2017'  // One-time fixed-date event
   * ]
   */
  static CUSTOM_EVENTS_DATES = [
    'New Year: 31.12.x-01.01.x',
    'Christmas: 24.12.x-26.12.x',
  ];

  /**
   * List of folder names to ignore during the scan.
   * Any directory matching a name in this list will be skipped.
   */
  static IGNORE_DIRECTORIES = [
    '#Ignored',
  ];

  /**
   * List of recognized photo file extensions.
   * Files with these extensions will be considered image files.
   */
  static PHOTO_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.heic', '.heif',
    '.webp', '.raw', '.arw', '.cr2', '.nef', '.orf', '.sr2', '.dng', '.rw2', '.raf',
    '.psd', '.xcf', '.ai', '.indd', '.svg', '.eps', '.pdf', '.lrtemplate', '.xmp'
  ];

  /**
   * List of recognized video file extensions.
   * Files with these extensions will be considered video files.
   */
  static VIDEO_EXTENSIONS = [
    '.3gp', '.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv', '.mpeg', '.mpg',
    '.m4v', '.mts', '.m2ts', '.vob', '.rm', '.rmvb', '.asf', '.divx', '.xvid', '.ogv',
    '.ts', '.mxf', '.f4v', '.m2v', '.mpv', '.qt', '.mng', '.yuv', '.y4m', '.drc',
    '.f4p', '.f4a', '.f4b'
  ];
}

const TranslationKeys = Object.freeze({
  // Seasons
  WINTER: 'winter',
  SPRING: 'spring',
  SUMMER: 'summer',
  AUTUMN: 'autumn',
  UNKNOWN: 'unknown',

  // Console messages
  DIRECTORY: 'directory',
  UNSUPPORTED: 'unsupported',
  MOVED: 'moved',
  SKIPPED: 'skipped',
  DELETED: 'deleted',
  DELETED_DIR: 'deletedDir',
  IN_PLACE: 'inPlace',
  UNKNOWN_DIR: 'unknownDir',
  ERROR_MOVING: 'errorMoving',
  ERROR_MK_FOLDER: 'errorMkFolder',
  OPERATION_TIME: 'operationTime',
});

const Translations = Object.freeze({
  // Seasons
  [TranslationKeys.WINTER]: { ru: 'Зима', en: 'Winter' },
  [TranslationKeys.SPRING]: { ru: 'Весна', en: 'Spring' },
  [TranslationKeys.SUMMER]: { ru: 'Лето', en: 'Summer' },
  [TranslationKeys.AUTUMN]: { ru: 'Осень', en: 'Autumn' },
  [TranslationKeys.UNKNOWN]: { ru: 'Неопределен', en: 'Unknown' },

  // Console messages
  [TranslationKeys.DIRECTORY]: { ru: 'Сканируемая папка', en: 'Scanned Directory' },
  [TranslationKeys.UNSUPPORTED]: { ru: 'Пропущен файл с неподдерживаемым расширением', en: 'Skipped file with unsupported extension' },
  [TranslationKeys.MOVED]: { ru: 'Перемещено', en: 'Moved' },
  [TranslationKeys.SKIPPED]: { ru: 'Пропущено', en: 'Skipped' },
  [TranslationKeys.DELETED]: { ru: 'Удалено', en: 'Deleted' },
  [TranslationKeys.DELETED_DIR]: { ru: 'Удалена пустая папка', en: 'Deleted empty folder' },
  [TranslationKeys.IN_PLACE]: { ru: 'Файл уже перемещен', en: 'File already in correct folder' },
  [TranslationKeys.UNKNOWN_DIR]: { ru: '#Неизвестные Даты', en: '#Unknown Dates' },
  [TranslationKeys.ERROR_MOVING]: { ru: 'Ошибка перемещения', en: 'Error moving' },
  [TranslationKeys.ERROR_MK_FOLDER]: { ru: 'Ошибка при создании папки', en: 'Failed to create folder' },
  [TranslationKeys.OPERATION_TIME]: { ru: 'Время выполнения', en: 'Sorting time' },
});

class TimelineMediaSorter {
  #movedFilesLength = 0;
  #skippedFilesLength = 0;
  #deletedFilesLength = 0;
  #videoFolderName = 'Video';
  #lang = (Intl.DateTimeFormat().resolvedOptions().locale || 'en').startsWith('ru') ? 'ru' : 'en';

  #moveFile = util.promisify(fs.rename);

  async organizeFiles() {
    LoggerUtils.printHeader();
    LoggerUtils.cyan(`📂 ${this.#l10n(TranslationKeys.DIRECTORY)}: ${rootPath}`);
    LoggerUtils.indent('-');
    await this.#performanceWrapper(this.#organizeFiles.bind(this));
    LoggerUtils.printFooter();
    if (TimelineMediaSorterSettings.SAVE_LOGS) {
      LoggerUtils.saveLogsToFile(rootPath, '#TimelineMediaSorterLogs.txt');
    }
  }

  async #organizeFiles() {
    const allFiles = (await this.#walkDir(rootPath)).sort();

    for (const filePath of allFiles) {
      const filename = path.basename(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const dateInfo = this.#parseDateFromFilename(filename);

      if (
        !TimelineMediaSorterSettings.PHOTO_EXTENSIONS.includes(ext) &&
        !TimelineMediaSorterSettings.VIDEO_EXTENSIONS.includes(ext)
      ) {
        this.#skippedFilesLength++;
        LoggerUtils.yellow(`⚠️ ${this.#l10n(TranslationKeys.UNSUPPORTED)}: ${filePath}`);
        continue;
      }

      let targetDir;

      if (dateInfo) {
        const { year, month, day } = dateInfo;
        const mediaDate = new Date(Number(year),Number(month) - 1, Number(day));
        const customEvent = this.#getCustomEventMatch(mediaDate);

        if (customEvent) {
          const eventPath = customEvent.name.split('|');
          const eventYear = String(customEvent.year);
          targetDir = path.join(rootPath, ...eventPath, eventYear);
        } else {
          const season = this.#getSeasonName(month);
          const seasonFolder = `${season} ${year}`;
          targetDir = path.join(rootPath, year, seasonFolder);
        }
        
        if (TimelineMediaSorterSettings.VIDEO_EXTENSIONS.includes(ext)) {
          targetDir = path.join(targetDir, this.#videoFolderName);
        }
      } else {
        targetDir = path.join(rootPath, this.#l10n(TranslationKeys.UNKNOWN_DIR));
        if (TimelineMediaSorterSettings.VIDEO_EXTENSIONS.includes(ext)) {
          targetDir = path.join(targetDir, this.#videoFolderName);
        }
      }

      try {
        await fs.promises.mkdir(targetDir, { recursive: true });
      } catch (err) {
        this.#skippedFilesLength++;
        LoggerUtils.red(`⛔ ${this.#l10n(TranslationKeys.ERROR_MK_FOLDER)}: ${targetDir}:\n${err.message}`);
        continue;
      }

      const targetPath = path.join(targetDir, filename);
      const targetFolder = path.join('...', path.relative(rootPath, targetDir));

      if (filePath === targetPath) {
        this.#skippedFilesLength++;
        LoggerUtils.yellow(`☑️ ${this.#l10n(TranslationKeys.IN_PLACE)}: ${filePath}`);
        continue;
      }

      try {
        await this.#moveFile(filePath, targetPath);
        this.#movedFilesLength++;
        LoggerUtils.green(`✅ ${this.#l10n(TranslationKeys.MOVED)}: ${filePath} → ${targetFolder}`);
      } catch (err) {
        this.#skippedFilesLength++;
        LoggerUtils.red(`⛔ ${this.#l10n(TranslationKeys.ERROR_MOVING)}: ${filePath}:\n${err.message}`);
      }
    }

    await this.#deleteEmptyDirs(rootPath);
  }

  #l10n(key) {
    return Translations[key]?.[this.#lang] || key;
  }

  #getSeasonName(month) {
    const m = parseInt(month, 10);
    if ([12, 1, 2].includes(m)) return this.#l10n(TranslationKeys.WINTER);
    if ([3, 4, 5].includes(m)) return this.#l10n(TranslationKeys.SPRING);
    if ([6, 7, 8].includes(m)) return this.#l10n(TranslationKeys.SUMMER);
    if ([9, 10, 11].includes(m)) return this.#l10n(TranslationKeys.AUTUMN);
    return this.#l10n(TranslationKeys.UNKNOWN);
  }

  #getCustomEventMatch(date) {
    const eventYear = date.getFullYear();
    const customEvents = this.#getCustomEvents();

    for (const customEvent of customEvents) {
      const { name, start, end } = customEvent;

      const crossesYear = end.month < start.month || (end.month === start.month && end.day < start.day);
      const startYear = start.year || (crossesYear ? eventYear - 1 : eventYear);
      const endYear = end.year || eventYear;

      const startDate = new Date(startYear, start.month - 1, start.day);
      const endDate = new Date(endYear, end.month - 1, end.day);
      endDate.setHours(23, 59, 59, 999);

      if (date >= startDate && date <= endDate) {
        return { name, year: endYear };
      }
    }

    return null;
  }

  #getCustomEvents() {
    const parseDate = (str) => {
      const [day, month, year] = str.split('.');
      return {
        day: parseInt(day) || null,
        month: parseInt(month) || null,
        year: parseInt(year) || null,
      };
    };

    return TimelineMediaSorterSettings.CUSTOM_EVENTS_DATES.map(customEvent => {
      const [name, rawDates] = customEvent.split(':').map(s => s.trim());
      const [startRaw, endRaw] = rawDates.includes('-')
        ? rawDates.split('-').map(d => d.trim())
        : [rawDates.trim(), rawDates.trim()];

      return {
        name,
        start: parseDate(startRaw),
        end: parseDate(endRaw)
      };
    });
  }

  async #walkDir(dir, fileList = []) {
    const files = await fs.promises.readdir(dir);
    for (const file of files) {
      if (TimelineMediaSorterSettings.IGNORE_DIRECTORIES.includes(file)) {
        continue;
      }

      const fullPath = path.join(dir, file);
      const stat = await fs.promises.stat(fullPath);
      if (stat.isDirectory()) {
        await this.#walkDir(fullPath, fileList);
      } else {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  #parseDateFromFilename(filename) {
    const regex = /(\d{4})-(\d{2})-(\d{2})_\d{2}-\d{2}-\d{2}/;
    const match = filename.match(regex);
    if (match) {
      const [, year, month, day] = match;
      return { year, month, day };
    }
    return null;
  }

  async #deleteEmptyDirs(dir) {
    const entries = await fs.promises.readdir(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = await fs.promises.stat(fullPath);
      if (stat.isDirectory()) {
        await this.#deleteEmptyDirs(fullPath);
        const remaining = await fs.promises.readdir(fullPath);
        if (remaining.length === 0) {
          this.#deletedFilesLength++;
          await fs.promises.rmdir(fullPath);
          LoggerUtils.yellow(`❌ ${this.#l10n(TranslationKeys.DELETED_DIR)}: ${fullPath}`);
        }
      }
    }
  }

  async #performanceWrapper(callback) {
    const startTime = Date.now();
    await callback().catch(LoggerUtils.red);
    const endTime = Date.now();
    const performance = this.#formatPerformance(endTime - startTime);
    LoggerUtils.indent('-');
    LoggerUtils.cyan(`✅ ${this.#l10n(TranslationKeys.MOVED)}: ${this.#movedFilesLength}`);
    LoggerUtils.cyan(`⚠️ ${this.#l10n(TranslationKeys.SKIPPED)}: ${this.#skippedFilesLength}`);
    LoggerUtils.cyan(`❌ ${this.#l10n(TranslationKeys.DELETED)}: ${this.#deletedFilesLength}`);
    LoggerUtils.cyan(`🕒 ${this.#l10n(TranslationKeys.OPERATION_TIME)}: ${performance}`);
    LoggerUtils.indent('-');
    LoggerUtils.indent();
  }

  #formatPerformance(ms) {
    const hours = Math.floor(ms / 3600000);
    ms %= 3600000;
    const minutes = Math.floor(ms / 60000);
    ms %= 60000;
    const seconds = Math.floor(ms / 1000);
    const milliseconds = Math.floor(ms % 1000);

    const pad = (n, len = 2) => String(n).padStart(len, '0');
    const padMs = (n) => String(n).padStart(3, '0');

    if (hours) {
      return `${pad(hours)}.${pad(minutes)}.${pad(seconds)}:${padMs(milliseconds)} (h.m.s:ms)`;
    } else if (minutes) {
      return `${pad(minutes)}.${pad(seconds)}:${padMs(milliseconds)} (m.s:ms)`;
    } else if (seconds) {
      return `${seconds}:${padMs(milliseconds)} (s:ms)`;
    } else {
      return `${milliseconds} (ms)`;
    }
  }
}

class LoggerUtils {
  static #logs = [];

  static printHeader() {
    this.clear();
    this.magenta(
      `╔═══════════════════════════════╗
║     Timeline Media Sorter     ║
╚═══════════════════════════════╝`
    );
    this.indent();
  }

  static printFooter() {
    this.magenta(
      `╔═══════════════════════════════╗
║      Thank You For Using      ║
║     Timeline Media Sorter     ║
║                               ║
║      © 2025 Sergei Babko      ║
║      All Rights Reserved      ║
╚═══════════════════════════════╝`
    );
    this.indent();
  }

  static clear() {
    console.clear();
  }

  static log(...args) {
    console.log(...args);
    this.saveToLogs(...args);
  }

  static indent(symbol) {
    LoggerUtils.log(symbol ? symbol.repeat(100) : '');
  }

  static cyan(message) {
    this.log('\x1b[96m%s\x1b[0m', message);
  }

  static green(message) {
    this.log('\x1b[92m%s\x1b[0m', message);
  }

  static yellow(message) {
    this.log('\x1b[93m%s\x1b[0m', message);
  }

  static red(message) {
    this.log('\x1b[91m%s\x1b[0m', message);
  }

  static magenta(message) {
    this.log('\x1b[95m%s\x1b[0m', message);
  }

  static saveToLogs(...args) {
    args.forEach(arg => {
      if (
        typeof arg !== 'string' ||
        !/^\x1B\[[0-9;]*m%s\x1B\[0m$/.test(arg)
      ) {
        this.#logs.push(arg);
      }
    });
  }

  static getLogs() {
    return this.#logs;
  }

  static getLogsText() {
    return this.getLogs().join('\n');
  }

  static saveLogsToFile(rootPath, fileName) {
    const logText = this.getLogsText();
    const targetPath = path.join(rootPath, fileName);
    fs.writeFileSync(targetPath, logText, 'utf-8');
  }
}

new TimelineMediaSorter().organizeFiles();
