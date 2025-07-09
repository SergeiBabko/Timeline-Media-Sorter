const fs = require('fs');
const path = require('path');
const util = require('util');

const rootPath = __dirname;

class TimelineMediaSorterSettings {
  /**
   * Enables or disables saving logs during the media sorting process.
   * Set to `true` to keep logs, or `false` to disable logging.
   */
  static SAVE_LOGS = false;

  /**
   * This object defines a list of user-defined events with optional date ranges
   * in "DD.MM.YYYY" format.
   *
   * Each entry is a string in the format:
   *    "FolderPath|Event Name: startDate-endDate"
   *
   * - FolderPath (optional) allows nesting events into subfolders, using "|", "\\", or "/" as a separator.
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
   * {
   *   'Events & Conferences|Conferences|Tech Conference 2023': '15.05.2023',           // Fixed one-day event
   *   'Events & Conferences|Conferences|UX Summit Europe': '10.06.2023-20.06.2023',    // Fixed multi-day event
   *   'Events & Conferences|Festivals|Winter Fest': '30.12.2023-02.01.2024',           // Fixed range crossing year
   *
   *   'Anniversaries|Work|Work Anniversary': '01.09.2010_2020',                        // Recurring one-day event with start and end years
   *   'Anniversaries|Work|Company Day': '15.03.>2015',                                 // Recurring one-day event with start year
   *   'Anniversaries|Family|Grandma’s Day': '10.04.<2010',                             // Recurring one-day event with end year
   *   'Anniversaries|Wedding|Anna & Tom': '14.02.2015-20.02.x',                        // Recurring multi-day event from fixed start
   *   'Anniversaries|Wedding|Emily & Jack': '10.06.x-14.06.2022',                      // Recurring multi-day event to fixed end
   *
   *   'Holidays|Cultural|Library Day': '12.09.x',                                      // Recurring one-day event with no limits
   *   'Holidays|Seasonal|Autumn Camp': '01.10.x-15.10.x',                              // Recurring multi-day event with no limits
   *   'Holidays|Global|New Year': '31.12.x-01.01.x',                                   // Recurring across new year
   *   'Holidays|Spring|Spring Festival': '21.03.>2018',                                // Recurring one-day with start year
   *   'Holidays|Old|Old Day': '30.06.<1995',                                           // Recurring one-day with end year
   *
   *   'Travel & Leisure|Europe Tour|Italy Adventure': [
   *     '05.05.2013-11.05.2013',
   *     '12.08.2019',
   *   ],                                                                               // Multiple instances of same event
   *   'Travel & Leisure|Family Trips|Trip to Grandma’s': [
   *     '23.08.2008-24.08.2008',
   *     '05.06.2009-29.06.2009',
   *     '24.07.2012',
   *   ],                                                                               // Multiple related visits
   * }
   */
  static CUSTOM_EVENTS_DATES = {
    'Holidays|New Year': '31.12.x-01.01.x',
    'Holidays|Christmas': '24.12.x-26.12.x',
  };

  /**
   * List of folder names to ignore during the scan.
   * Any directory matching a name in this list will be skipped.
   */
  static IGNORED_DIRECTORIES = [
    '#Sorted',
    '#Ignored',
    '#Сортировано',
    '#Игнорируется',
    'node_modules', // DO NOT REMOVE
  ];

  /**
   * List of file names to ignore during the scan.
   * Any file matching a name in this list will be skipped.
   */
  static IGNORED_FILES = [
    '#TimelineMediaRenamer.bat', // DO NOT REMOVE
    '#TimelineMediaRenamer.js',  // DO NOT REMOVE
    '#TimelineMediaSorter.bat',  // DO NOT REMOVE
    '#TimelineMediaSorter.js',   // DO NOT REMOVE
  ];

  /**
   * List of regular expressions to extract date information from filenames.
   * Each pattern attempts to match a specific date format in the filename.
   * The expected named capturing groups are: year, month, and day.
   */
  static DATE_PATTERNS = [
    // Format: YYYY-MM-DD_HH-MM-SS
    // Matches: IMG_2025-01-25_15-43-22.jpg
    /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})_\d{2}-\d{2}-\d{2}/,

    // Format: YYYY-MM-DD
    // Matches: IMG_2025-01-25.jpg
    /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/,

    // Format: DD-MM-YYYY_HH-MM-SS
    // Matches: IMG_25-01-2025_15-43-22.jpg
    /(?<day>\d{2})-(?<month>\d{2})-(?<year>\d{4})_\d{2}-\d{2}-\d{2}/,

    // Format: DD-MM-YYYY
    // Matches: IMG_25-01-2025.jpg
    /(?<day>\d{2})-(?<month>\d{2})-(?<year>\d{4})/,

    // Format: YYYY.MM.DD-HH.MM.SS
    // Matches: IMG_2025.01.25-12.30.45.jpg
    /(?<year>\d{4})\.(?<month>\d{2})\.(?<day>\d{2})-\d{2}\.\d{2}\.\d{2}/,

    // Format: YYYY.MM.DD
    // Matches: IMG_2025.01.25.jpg
    /(?<year>\d{4})\.(?<month>\d{2})\.(?<day>\d{2})/,

    // Format: DD.MM.YYYY-HH.MM.SS
    // Matches: IMG_25.01.2025-12.30.45.jpg
    /(?<day>\d{2})\.(?<month>\d{2})\.(?<year>\d{4})-\d{2}\.\d{2}\.\d{2}/,

    // Format: DD.MM.YYYY
    // Matches: IMG_25.01.2025.jpg
    /(?<day>\d{2})\.(?<month>\d{2})\.(?<year>\d{4})/,

    // Format: YYYYMMDD_HHMMSS
    // Matches: IMG_20250125_102030.jpg
    /(?<year>\d{4})(?<month>\d{2})(?<day>\d{2})_\d{6}/,

    // Format: YYYYMMDD
    // Matches: IMG_20250125.jpg
    /(?<year>\d{4})(?<month>\d{2})(?<day>\d{2})/,
  ];

  /**
   * List of recognized photo file extensions.
   * Files with these extensions will be considered image files.
   */
  static PHOTO_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.heic', '.heif',
    '.webp', '.raw', '.arw', '.cr2', '.nef', '.orf', '.sr2', '.dng', '.rw2', '.raf',
    '.psd', '.xcf', '.ai', '.indd', '.svg', '.eps', '.pdf', '.lrtemplate', '.xmp',
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

class TimelineMediaSorter {
  #movedFilesLength = 0;
  #skippedFilesLength = 0;
  #deletedFilesLength = 0;

  #moveFile = util.promisify(fs.rename);
  #mkDir = util.promisify(fs.mkdir);
  #readDir = util.promisify(fs.readdir);
  #rm = util.promisify(fs.rm);

  async sort() {
    LoggerUtils.printHeader();
    LoggerUtils.cyan(`📂 ${L10n.get(L10n.Keys.SCANNED_DIR)}: ${rootPath}`);
    LoggerUtils.indent('-');
    const performance = await PerformanceWrapper.getCallbackPerformance(this.#organizeFiles.bind(this));
    LoggerUtils.indent('-');
    LoggerUtils.cyan(`✅ ${L10n.get(L10n.Keys.MOVED)}: ${this.#movedFilesLength}`);
    LoggerUtils.cyan(`⚠️ ${L10n.get(L10n.Keys.SKIPPED)}: ${this.#skippedFilesLength}`);
    LoggerUtils.cyan(`❌ ${L10n.get(L10n.Keys.DELETED)}: ${this.#deletedFilesLength}`);
    LoggerUtils.cyan(`🕒 ${L10n.get(L10n.Keys.OPERATION_TIME)}: ${performance}`);
    LoggerUtils.indent('-');
    LoggerUtils.printFooter();
    if (TimelineMediaSorterSettings.SAVE_LOGS) {
      LoggerUtils.saveLogsToFile(rootPath, '#TimelineMediaSorterLogs.txt');
    }
  }

  async #organizeFiles() {
    const allFiles = (await this.#walkDir(rootPath)).sort();

    for (const filePath of allFiles) {
      const { fileName, fileExt } = this.#getFileNames(filePath);
      const dateInfo = this.#parseDateFromFilename(fileName);
      const supported = this.#isFileSupported(fileExt);
      const { targetDir, unsupportedDate } = this.#getTargetDestination(filePath, fileExt, dateInfo, supported);
      const targetPath = path.join(targetDir, fileName);

      if (filePath === targetPath) {
        this.#logWarning(L10n.Keys.IN_PLACE, filePath, '☑️');
        this.#skippedFilesLength++;
        continue;
      }

      if (!await this.#safeMkDir(targetDir)) continue;

      if (!await this.#safeMoveFile(filePath, targetPath)) continue;

      this.#logResult(filePath, targetDir, supported, unsupportedDate);
    }

    await this.#deleteEmptyDirs(rootPath);
  }

  #getFileNames(filePath) {
    const fileName = path.basename(filePath);
    const fileExt = path.extname(filePath).toLowerCase();
    return { fileName, fileExt };
  }

  #parseDateFromFilename(filename) {
    for (const pattern of TimelineMediaSorterSettings.DATE_PATTERNS) {
      const match = filename.match(pattern);
      if (match?.groups) {
        const { year, month, day } = match.groups;
        return { year, month, day };
      }
    }

    return null;
  }

  #isFileSupported(fileExt) {
    return TimelineMediaSorterSettings.PHOTO_EXTENSIONS.includes(fileExt) ||
      TimelineMediaSorterSettings.VIDEO_EXTENSIONS.includes(fileExt);
  }

  #getTargetDestination(filePath, fileExt, dateInfo, supported) {
    return (supported && dateInfo)
      ? { targetDir: this.#resolveKnownDateDestination(fileExt, dateInfo), unsupportedDate: null }
      : { targetDir: this.#resolveUnknownDateDestination(filePath, supported), unsupportedDate: supported };
  }

  #resolveKnownDateDestination(fileExt, dateInfo) {
    const { year, month, day } = dateInfo;
    const mediaDate = Utils.normalizedStart(year, month, day);
    const customEvent = EventsResolver.getCustomEventMatch(mediaDate);

    let targetDir = customEvent
      ? path.join(rootPath, ...EventsResolver.getCustomEventPath(customEvent))
      : path.join(rootPath, year, `${this.#getSeasonName(month)} ${year}`);

    if (TimelineMediaSorterSettings.VIDEO_EXTENSIONS.includes(fileExt)) {
      targetDir = path.join(targetDir, L10n.get(L10n.Keys.VIDEO_DIR_NAME));
    }

    return targetDir;
  }

  #resolveUnknownDateDestination(filePath, supported) {
    const folderName = supported
      ? L10n.get(L10n.Keys.UNKNOWN_DATES_DIR_NAME)
      : L10n.get(L10n.Keys.UNKNOWN_FILES_DIR_NAME);

    const relativeDir = path.relative(rootPath, path.dirname(filePath));
    return path.join(rootPath, folderName, relativeDir);
  }

  #getSeasonName(month) {
    const m = parseInt(month, 10);
    if ([12, 1, 2].includes(m)) return L10n.get(L10n.Keys.WINTER);
    if ([3, 4, 5].includes(m)) return L10n.get(L10n.Keys.SPRING);
    if ([6, 7, 8].includes(m)) return L10n.get(L10n.Keys.SUMMER);
    if ([9, 10, 11].includes(m)) return L10n.get(L10n.Keys.AUTUMN);
    return L10n.get(L10n.Keys.UNKNOWN);
  }

  async #safeMkDir(targetDir) {
    try {
      await this.#mkDir(targetDir, { recursive: true });
      return true;
    } catch (err) {
      this.#logError(L10n.Keys.ERROR_MK_DIR, targetDir, err);
      this.#skippedFilesLength++;
      return false;
    }
  }

  async #safeMoveFile(filePath, targetPath) {
    try {
      await this.#moveFile(filePath, targetPath);
      return true;
    } catch (err) {
      this.#logError(L10n.Keys.ERROR_MOVING, filePath, err);
      this.#skippedFilesLength++;
      return false;
    }
  }

  async #walkDir(dir, fileList = []) {
    let entries;

    try {
      entries = await this.#readDir(dir, { withFileTypes: true });
    } catch (err) {
      this.#logError(L10n.Keys.ERROR_RD_DIR, dir, err);
      return fileList;
    }

    for (const entry of entries) {
      const entryName = entry.name;
      const fullPath = path.join(dir, entryName);

      const isIgnoredDir = entry.isDirectory() && (
        TimelineMediaSorterSettings.IGNORED_DIRECTORIES
          .some(ignored => ignored.toLowerCase() === entryName.toLowerCase())
        || entryName.startsWith('.')
      );

      const isIgnoredFile = entry.isFile() &&
        TimelineMediaSorterSettings.IGNORED_FILES
          .some(ignored => ignored.toLowerCase() === entryName.toLowerCase());

      if (isIgnoredDir || isIgnoredFile) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.#walkDir(fullPath, fileList);
      } else {
        fileList.push(fullPath);
      }
    }

    return fileList;
  }

  async #deleteEmptyDirs(dir) {
    let entries;

    try {
      entries = await this.#readDir(dir, { withFileTypes: true });
    } catch (err) {
      this.#logError(L10n.Keys.ERROR_RD_DIR, dir, err);
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (!entry.isDirectory()) continue;

      await this.#deleteEmptyDirs(fullPath);

      let remaining;

      try {
        remaining = await this.#readDir(fullPath);
      } catch (err) {
        this.#logError(L10n.Keys.ERROR_RD_DIR, fullPath, err);
        continue;
      }

      if (remaining.length > 0) continue;

      try {
        await this.#rm(fullPath, { recursive: true });
        LoggerUtils.yellow(`❌ ${L10n.get(L10n.Keys.DELETED_DIR)}: ${fullPath}`);
        this.#deletedFilesLength++;
      } catch (err) {
        this.#logError(L10n.Keys.ERROR_RM_DIR, fullPath, err);
      }
    }
  }

  #logResult(filePath, targetDir, supported, unsupportedDate) {
    const relativeTarget = path.join('...', path.relative(rootPath, targetDir));
    const fromTo = `${filePath} → ${relativeTarget}`;

    if (!supported) {
      this.#skippedFilesLength++;
      this.#logWarning(L10n.Keys.UNSUPPORTED_EXT, fromTo);
    } else if (unsupportedDate) {
      this.#skippedFilesLength++;
      this.#logWarning(L10n.Keys.UNSUPPORTED_DATE, fromTo);
    } else {
      this.#movedFilesLength++;
      this.#logSuccess(L10n.Keys.MOVED, fromTo);
    }
  }

  #logSuccess(key, filePath) {
    LoggerUtils.green(`✅ ${L10n.get(key)}: ${filePath}`);
  }

  #logWarning(key, filePath, icon = `⚠️`) {
    LoggerUtils.yellow(`${icon} ${L10n.get(key)}: ${filePath}`);
  }

  #logError(key, filePath, err) {
    const message = err?.message ? `:\n${err.message}` : '';
    LoggerUtils.red(`⛔ ${L10n.get(key)}: ${filePath}${message}`);
  }
}

class PerformanceWrapper {
  static async getCallbackPerformance(callback) {
    const startTime = Date.now();
    await callback().catch(LoggerUtils.red);
    const endTime = Date.now();
    return PerformanceWrapper.#formatPerformance(endTime - startTime);
  }

  static #formatPerformance(ms) {
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

class EventsResolver {
  static getCustomEventMatch(date) {
    const year = date.getFullYear();
    const customEvents = EventsResolver.#getCustomEvents();

    for (const customEvent of customEvents) {
      let match = false;
      const crossedYears = [];
      const { name, start, end, fixedRange, recurring, singleDay, crossesYear } = customEvent;

      if (fixedRange) {
        const startDate = Utils.normalizedStart(start.year, start.month, start.day);
        const endDate = Utils.normalizedEnd(end.year, end.month, end.day);

        if (date >= startDate && date <= endDate) {
          match = true;

          if (crossesYear) {
            crossedYears.push(start.year);
            crossedYears.push(end.year);
          }
        }
      } else if (recurring) {
        if (singleDay) {
          const matchesDayMonth = date.getDate() === start.day && date.getMonth() + 1 === start.month;

          if (!matchesDayMonth) continue;

          match = Utils.inRange(start.year, year, end.year);
        } else {
          if (!Utils.inRange(start.year, year, end.year)) continue;

          if (crossesYear) {
            const clamp = EventsResolver.#clampYear;
            const prevStart = Utils.normalizedStart(clamp(year - 1, start.year, true), start.month, start.day);
            const prevEnd = Utils.normalizedEnd(clamp(year, end.year, false), end.month, end.day);
            const currStart = Utils.normalizedStart(clamp(year, start.year, true), start.month, start.day);
            const currEnd = Utils.normalizedEnd(clamp(year + 1, end.year, false), end.month, end.day);

            if (date >= prevStart && date <= prevEnd) {
              match = true;
              crossedYears.push(prevStart.getFullYear());
              crossedYears.push(prevEnd.getFullYear());
            }

            if (date >= currStart && date <= currEnd) {
              match = true;
              crossedYears.push(currStart.getFullYear());
              crossedYears.push(currEnd.getFullYear());
            }
          } else {
            const startDate = Utils.normalizedStart(year, start.month, start.day);
            const endDate = Utils.normalizedEnd(year, end.month, end.day);

            if (date >= startDate && date <= endDate) {
              match = true;
            }
          }
        }
      }

      if (match) {
        return { name, year, recurring, crossedYears };
      }
    }

    return null;
  }

  static getCustomEventPath(customEvent) {
    const { name, year, recurring, crossedYears } = customEvent;

    const getYears = () => {
      if (crossedYears.length) {
        return `${crossedYears[0]}-${crossedYears[1]}`;
      }
      return year;
    };

    const folderNames = name.split(/[\\/|]/);
    const updatedFolderNames = folderNames.map((name, idx) => {
      if (!recurring && idx === folderNames.length - 1) {
        return `${name} ${getYears()}`;
      }

      return name;
    });

    if (recurring) {
      const lastFolderName = updatedFolderNames[updatedFolderNames.length - 1];
      updatedFolderNames.push(`${lastFolderName} ${getYears()}`);
    }

    return updatedFolderNames;
  };

  static #getCustomEvents() {
    const recRegex = /[><_]/;

    const isEmptyDate = date => Object.values(date).every(value => !Utils.exists(value));

    const isFullDate = date => Object.values(date).every(Utils.exists);

    const lacksYear = date => Utils.exists(date.day) && Utils.exists(date.month) && !Utils.exists(date.year);

    const isSingleDay = (start, end) =>
      Utils.exists(start.day) &&
      Utils.exists(start.month) &&
      Utils.exists(end.day) &&
      Utils.exists(end.month) &&
      start.day === end.day &&
      start.month === end.month &&
      (
        start.year === end.year ||
        Utils.exists(start.year) && !Utils.exists(end.year) ||
        !Utils.exists(start.year) && Utils.exists(end.year)
      );

    const events = EventsResolver.#getPreparedEvents().map(([name, rawDates]) => {
      const { startRaw, endRaw } = EventsResolver.#prepareDates(rawDates);

      const start = EventsResolver.#parseDate(startRaw);
      const end = EventsResolver.#parseDate(endRaw);

      if (isEmptyDate(start) && isEmptyDate(end)) return;

      const singleDay = isSingleDay(start, end) || recRegex.test(rawDates);
      const recurring = recRegex.test(rawDates) || lacksYear(start) || lacksYear(end);
      const fixedRange = !recurring && isFullDate(start) && isFullDate(end);
      const crossesYear = !singleDay && (
        Utils.exists(start.year) && Utils.exists(end.year) && start.year < end.year ||
        Utils.exists(start.month) && Utils.exists(end.month) && start.month > end.month ||
        Utils.exists(start.month) && Utils.exists(end.month) && Utils.exists(start.day) && Utils.exists(end.day) &&
        start.month === end.month && start.day > end.day
      );

      return { name, start, end, fixedRange, singleDay, recurring, crossesYear };
    }).filter(Boolean);

    return EventsResolver.#sortEvents(events);
  }

  static #clampYear(baseYear, limitYear, preferHigher) {
    if (!Utils.exists(limitYear)) return baseYear;
    return preferHigher ? Math.max(baseYear, limitYear) : Math.min(baseYear, limitYear);
  };

  static #prepareDates(rawDates) {
    const dateDivider = '.';
    const rangeDivider = '-';
    const emptyYearSymbol = 'x';
    const recStartSymbol = '>';
    const recEndSymbol = '<';
    const recDivider = '_';

    let startRaw, endRaw;

    if (rawDates.includes(recDivider)) {
      const [day, month, yearPart] = rawDates.split(dateDivider, 3) || [];
      const [startYear, endYear] = yearPart.match(/\d{4}/g);
      startRaw = [day, month, startYear].join('.');
      endRaw = [day, month, endYear].join('.');
    } else if (rawDates.includes(recStartSymbol)) {
      startRaw = rawDates.replace(recStartSymbol, '');
      endRaw = rawDates.split(recStartSymbol, 2)[0] + emptyYearSymbol;
    } else if (rawDates.includes(recEndSymbol)) {
      endRaw = rawDates.replace(recEndSymbol, '');
      startRaw = rawDates.split(recEndSymbol, 2)[0] + emptyYearSymbol;
    } else if (rawDates.includes(rangeDivider)) {
      [startRaw, endRaw] = rawDates.split(rangeDivider, 2);
    } else {
      startRaw = endRaw = rawDates;
    }

    return { startRaw, endRaw };
  };

  static #parseDate(rawDate) {
    const dateDivider = '.';
    const [day, month, year] = rawDate?.split(dateDivider, 3) || [];

    return {
      day: parseInt(day) || null,
      month: parseInt(month) || null,
      year: parseInt(year) || null,
    };
  };

  static #getPreparedEvents() {
    const events = [];

    const clearStr = (str) => str?.replace(/\s+/g, ' ').trim();

    const customEvents = Object.entries(TimelineMediaSorterSettings.CUSTOM_EVENTS_DATES);
    customEvents.forEach(([name, dates]) => {
      if (!dates?.length) return;

      const eventName = clearStr(name);
      if (Array.isArray(dates)) {
        dates.forEach(date => events.push([eventName, clearStr(date)]));
      } else if (typeof dates === 'string') {
        events.push([eventName, clearStr(dates)]);
      }
    });

    return events;
  };

  static #sortEvents(events) {
    return events.sort((a, b) => EventsResolver.#categorizeEvent(a) - EventsResolver.#categorizeEvent(b));
  }

  static #categorizeEvent(event) {
    const { start, end, fixedRange, singleDay, recurring } = event;

    const hasStartYear = Utils.exists(start.year);
    const hasEndYear = Utils.exists(end.year);

    if (!recurring) {
      if (fixedRange && singleDay) return 1;
      if (fixedRange && !singleDay) return 2;
    }

    if (recurring) {
      if (singleDay && hasStartYear && hasEndYear) return 3;
      if (singleDay && !hasStartYear && hasEndYear) return 4;
      if (singleDay && hasStartYear && !hasEndYear) return 5;

      if (!singleDay && hasStartYear && hasEndYear) return 6;
      if (!singleDay && !hasStartYear && hasEndYear) return 7;
      if (!singleDay && hasStartYear && !hasEndYear) return 8;

      if (singleDay && !hasStartYear && !hasEndYear) return 9;
      if (!singleDay && !hasStartYear && !hasEndYear) return 10;
    }

    return 999;
  };
}

class Utils {
  static exists(value) {
    return value != null;
  }

  static inRange(start, value, end) {
    if (Utils.exists(start) && Utils.exists(end)) {
      if (value >= start && value <= end) return true;
    } else if (Utils.exists(start)) {
      if (value >= start) return true;
    } else if (Utils.exists(end)) {
      if (value <= end) return true;
    } else {
      return true;
    }

    return false;
  }

  static normalizedStart(year, month, day) {
    const date = new Date(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  static normalizedEnd(year, month, day) {
    const date = new Date(year, month - 1, day);
    date.setHours(23, 59, 59, 999);
    return date;
  }
}

class L10n {
  static Keys = Object.freeze({
    // Seasons
    WINTER: 'winter',
    SPRING: 'spring',
    SUMMER: 'summer',
    AUTUMN: 'autumn',
    UNKNOWN: 'unknown',

    // Folder names
    VIDEO_DIR_NAME: 'videoDir',
    UNKNOWN_DATES_DIR_NAME: 'unknownDatesDir',
    UNKNOWN_FILES_DIR_NAME: 'unknownFilesDir',

    // Console messages
    MOVED: 'moved',
    SKIPPED: 'skipped',
    DELETED: 'deleted',
    IN_PLACE: 'inPlace',
    SCANNED_DIR: 'dir',
    DELETED_DIR: 'deletedDir',
    UNSUPPORTED_EXT: 'unsupportedExt',
    UNSUPPORTED_DATE: 'unsupportedDate',
    ERROR_MOVING: 'errorMoving',
    ERROR_RD_DIR: 'errorRdFolder',
    ERROR_MK_DIR: 'errorMkFolder',
    ERROR_RM_DIR: 'errorRmFolder',
    OPERATION_TIME: 'operationTime',
  });

  static Translations = Object.freeze({
    // Seasons
    [L10n.Keys.WINTER]: { ru: 'Зима', en: 'Winter' },
    [L10n.Keys.SPRING]: { ru: 'Весна', en: 'Spring' },
    [L10n.Keys.SUMMER]: { ru: 'Лето', en: 'Summer' },
    [L10n.Keys.AUTUMN]: { ru: 'Осень', en: 'Autumn' },
    [L10n.Keys.UNKNOWN]: { ru: 'Неопределен', en: 'Unknown' },

    // Folder names
    [L10n.Keys.VIDEO_DIR_NAME]: { ru: 'Видео', en: 'Videos' },
    [L10n.Keys.UNKNOWN_DATES_DIR_NAME]: { ru: '#Неизвестные Даты', en: '#Unknown Dates' },
    [L10n.Keys.UNKNOWN_FILES_DIR_NAME]: { ru: '#Неизвестные Файлы', en: '#Unknown Files' },

    // Console messages
    [L10n.Keys.MOVED]: { ru: 'Перемещено', en: 'Moved' },
    [L10n.Keys.SKIPPED]: { ru: 'Пропущено', en: 'Skipped' },
    [L10n.Keys.DELETED]: { ru: 'Удалено', en: 'Deleted' },
    [L10n.Keys.IN_PLACE]: { ru: 'Файл уже перемещен', en: 'File already in correct folder' },
    [L10n.Keys.SCANNED_DIR]: { ru: 'Сканируемая папка', en: 'Scanned Directory' },
    [L10n.Keys.DELETED_DIR]: { ru: 'Удалена пустая папка', en: 'Deleted empty folder' },
    [L10n.Keys.UNSUPPORTED_EXT]: { ru: 'Пропущен файл с неподдерживаемым расширением', en: 'Skipped file with unsupported extension' },
    [L10n.Keys.UNSUPPORTED_DATE]: { ru: 'Пропущен файл с неизвестной датой', en: 'Skipped file with unknown date' },
    [L10n.Keys.ERROR_MOVING]: { ru: 'Ошибка перемещения', en: 'Error moving' },
    [L10n.Keys.ERROR_RD_DIR]: { ru: 'Ошибка при чтении папки', en: 'Failed to read the folder' },
    [L10n.Keys.ERROR_MK_DIR]: { ru: 'Ошибка при создании папки', en: 'Failed to create the folder' },
    [L10n.Keys.ERROR_RM_DIR]: { ru: 'Ошибка при удалении папки', en: 'Failed to remove the folder' },
    [L10n.Keys.OPERATION_TIME]: { ru: 'Время выполнения', en: 'Execution time' },
  });

  static Language = (Intl.DateTimeFormat().resolvedOptions().locale || 'en').startsWith('ru') ? 'ru' : 'en';

  static get(key) {
    return L10n.Translations[key]?.[L10n.Language] || key;
  }
}

class LoggerUtils {
  static #logText = '';

  static printHeader() {
    LoggerUtils.clear();
    LoggerUtils.magenta(
      `╔═══════════════════════════════╗
║     Timeline Media Sorter     ║
╚═══════════════════════════════╝`
    );
    LoggerUtils.indent();
  }

  static printFooter() {
    LoggerUtils.indent();
    LoggerUtils.magenta(
      `╔═══════════════════════════════╗
║      Thank You For Using      ║
║     Timeline Media Sorter     ║
║                               ║
║      © 2025 Sergei Babko      ║
║      All Rights Reserved      ║
╚═══════════════════════════════╝`
    );
    LoggerUtils.indent();
  }

  static clear() {
    console.clear();
  }

  static log(...args) {
    console.log(...args);
    LoggerUtils.saveToLogs(...args);
  }

  static indent(symbol) {
    LoggerUtils.log(symbol ? symbol.repeat(100) : '');
  }

  static cyan(message) {
    LoggerUtils.log('\x1b[96m%s\x1b[0m', message);
  }

  static green(message) {
    LoggerUtils.log('\x1b[92m%s\x1b[0m', message);
  }

  static yellow(message) {
    LoggerUtils.log('\x1b[93m%s\x1b[0m', message);
  }

  static red(message) {
    LoggerUtils.log('\x1b[91m%s\x1b[0m', message);
  }

  static magenta(message) {
    LoggerUtils.log('\x1b[95m%s\x1b[0m', message);
  }

  static saveToLogs(...args) {
    args.forEach(arg => {
      if (
        typeof arg !== 'string' ||
        !/^\x1B\[[0-9;]*m%s\x1B\[0m$/.test(arg)
      ) {
        LoggerUtils.#logText += arg + '\n';
      }
    });
  }

  static getLogs() {
    return LoggerUtils.#logText;
  }

  static saveLogsToFile(rootPath, fileName) {
    const logText = LoggerUtils.getLogs();
    const targetPath = path.join(rootPath, fileName);
    fs.writeFileSync(targetPath, logText, 'utf-8');
  }
}

new TimelineMediaSorter().sort();
