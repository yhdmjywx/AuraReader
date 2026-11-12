import before from '@readium/css/css/dist/ReadiumCSS-before.css?raw';
import defaults from '@readium/css/css/dist/ReadiumCSS-default.css?raw';
import after from '@readium/css/css/dist/ReadiumCSS-after.css?raw';
import rtlBefore from '@readium/css/css/dist/rtl/ReadiumCSS-before.css?raw';
import rtlDefault from '@readium/css/css/dist/rtl/ReadiumCSS-default.css?raw';
import rtlAfter from '@readium/css/css/dist/rtl/ReadiumCSS-after.css?raw';
import cjkBefore from '@readium/css/css/dist/cjk-horizontal/ReadiumCSS-before.css?raw';
import cjkDefault from '@readium/css/css/dist/cjk-horizontal/ReadiumCSS-default.css?raw';
import cjkAfter from '@readium/css/css/dist/cjk-horizontal/ReadiumCSS-after.css?raw';
import verticalBefore from '@readium/css/css/dist/cjk-vertical/ReadiumCSS-before.css?raw';
import verticalDefault from '@readium/css/css/dist/cjk-vertical/ReadiumCSS-default.css?raw';
import verticalAfter from '@readium/css/css/dist/cjk-vertical/ReadiumCSS-after.css?raw';

export const readiumStyles = {
    ltr: { before, defaults, after },
    rtl: { before: rtlBefore, defaults: rtlDefault, after: rtlAfter },
    cjk: { before: cjkBefore, defaults: cjkDefault, after: cjkAfter },
    vertical: { before: verticalBefore, defaults: verticalDefault, after: verticalAfter }
};
