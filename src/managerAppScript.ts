import { MANAGER_APP_SCRIPT_ADVERTISEMENT } from './managerAppScriptParts/advertisement';
import { MANAGER_APP_SCRIPT_BINDINGS } from './managerAppScriptParts/bindings';
import { MANAGER_APP_SCRIPT_CORE } from './managerAppScriptParts/core';
import { MANAGER_APP_SCRIPT_LIFECYCLE } from './managerAppScriptParts/lifecycle';
import { MANAGER_APP_SCRIPT_PROMOTION } from './managerAppScriptParts/promotion';

export const MANAGER_APP_SCRIPT = [
  MANAGER_APP_SCRIPT_CORE,
  MANAGER_APP_SCRIPT_PROMOTION,
  MANAGER_APP_SCRIPT_ADVERTISEMENT,
  MANAGER_APP_SCRIPT_LIFECYCLE,
  MANAGER_APP_SCRIPT_BINDINGS,
].join('');
