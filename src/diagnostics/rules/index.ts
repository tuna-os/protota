/**
 * The HIG rule catalog (design §4): one HigRule[] module per HIG area.
 * All 24 catalogued rules — HIG-E001..E004, W001..W014, S001..S006 —
 * including the 8 ported from src/utils/higLinter.ts (the old
 * HIG-I001/I002 became suggestions HIG-S001/S002).
 */
import type { HigRule } from './types';
import { windowRules } from './windows';
import { buttonRules } from './buttons';
import { dialogRules } from './dialogs';
import { menuRules } from './menus';
import { headerBarRules } from './headerBars';
import { layoutRules } from './layout';
import { viewSwitcherRules } from './viewSwitchers';
import { textFieldRules } from './textFields';
import { placeholderRules } from './placeholders';
import { writingStyleRules } from './writingStyle';

export const ALL_HIG_RULES: HigRule[] = [
  ...windowRules,
  ...buttonRules,
  ...dialogRules,
  ...menuRules,
  ...headerBarRules,
  ...layoutRules,
  ...viewSwitcherRules,
  ...textFieldRules,
  ...placeholderRules,
  ...writingStyleRules,
];

export type { HigRule, RuleContext, RuleMatch } from './types';
