// Copyright (c) 2022 Siemens

/**
 * @module propRenderTemplates/Crt1IssueCountRenderer
 */
 import { includeComponent } from 'js/moduleLoader';
 import { renderComponent } from 'js/declReactUtils';
 import cdm from 'soa/kernel/clientDataModel';
 import appCtxService from 'js/appCtxService';
 
 let exports = {};
 
 let _loadViewAndAppendIcon = function( viewToRender, vmo, containerElement, propName ) {
    
     let subPanelContextForTooltipWithPropertyOverride = {
         treeNodeUid: vmo,
         isEnabled: vmo.props[propName].isEnabled,
         dbValue: vmo.props[propName].dbValue,
         displayName: vmo.props[propName].dbValue,
         vrObject: appCtxService.ctx.pselected
     };
     let subPanelContext = {
         subPanelContextForTooltipWithPropertyOverride
     };
     let extendedTooltipElement = includeComponent(viewToRender, subPanelContext);     
     if (containerElement) {
         containerElement.style.overflowY = 'hidden';
         renderComponent(extendedTooltipElement, containerElement);
         return containerElement;
     }
 };
 
 /**
  * Generates DOM Element for evm1Include
  * @param {Object} vmo - ViewModelObject for which element config is being rendered
  * @param {Object} containerElem - The container DOM Element inside which element config will be rendered
  * @param {String} propName - the name of property to render
  */
 export let issuePropertyRendererFunc = function( vmo, containerElem, propName ) {
     let _propertyToBeRendered = vmo.props && vmo.props[ propName ];
     let viewToRender = propName + 'Renderer';
 
     if( _propertyToBeRendered ) {
         _loadViewAndAppendIcon( viewToRender, vmo, containerElem, propName );
     }
 };
 
 export default exports = {
    issuePropertyRendererFunc
 };
 