// Copyright (c) 2022 Siemens

/**
 * native construct to hold the server version information related to the AW server release.
 *
 * @module propRenderTemplates/generateTracelinkProperty
 * @requires app
 */
import { getBaseUrlPath } from 'app';
import appCtxSvc from 'js/appCtxService';
import arm0CreateTraceLink from 'js/Arm0CreateTraceLink';
import cmm from 'soa/kernel/clientMetaModel';
import localeSvc from 'js/localeService';
import { svgString as cmdCreateTraceLink } from 'image/cmdCreateTraceLink24.svg';
import { svgString as indicatorTraceLink } from 'image/indicatorTraceLink16.svg';

/**
 * Generates Tracelink DOM Element for Awb0Element or Summary Table Proxy object
 * @param { Object } vmo - ViewModelObject for which Tracelink is being rendered
 * @param { Object } containerElem - The container DOM Element inside which Tracelink will be rendered
 */
export let generateAwb0TraceLinkFlagRendererFn = function( vmo, containerElem ) {
    var reqDashboardTable = appCtxSvc.getCtx( 'reqDashboardTable' );
    if ( cmm.isInstanceOf( 'Awb0Element', vmo.modelType ) && vmo.props && vmo.props.awb0TraceLinkFlag ) {
        var has_trace_link = vmo.props.awb0TraceLinkFlag.dbValues[0];

        if( reqDashboardTable ) {
            if( has_trace_link !== '0' ) {
                _renderTracelinkIndicator( vmo, containerElem, has_trace_link, reqDashboardTable );
            }
        } else {
            _renderTracelinkIndicator( vmo, containerElem, has_trace_link );
        }
    }
};

/**
 * @param { Object } vmo - ViewModelObject for which Tracelink is being rendered
 * @param { Object } containerElem - The container DOM Element inside which Tracelink will be rendered
 * @param {String} hasTracelinkflag - 1 or 0
 * @param {Object} reqDashboardTable reqDashboardTable AppCtx
 */
var _renderTracelinkIndicator = function( vmo, containerElem, hasTracelinkflag, reqDashboardTable ) {
    var cellImg = document.createElement( 'span' );
    cellImg.className = 'aw-visual-indicator aw-requirementsmanager-summaryTableIcon';
    var resource = 'RequirementsCommandPanelsMessages';
    var localTextBundle = localeSvc.getLoadedText( resource );
    
    cellImg.alt = localTextBundle.createTraceLinkTitle;
    cellImg.title = localTextBundle.createTraceLinkTitle;
    var imgSrc = null;
    if ( hasTracelinkflag === '1' || hasTracelinkflag === '2' ) {
        imgSrc = indicatorTraceLink;
    } else {
        imgSrc = cmdCreateTraceLink;
    }
    var objectUid = vmo.uid;
    if ( vmo.type === 'Arm0SummaryTableProxy' && vmo.props.arm0SourceElement ) {
        objectUid = vmo.props.arm0SourceElement.dbValues[0];
    }
    if( !reqDashboardTable ) {
        // Add click event to open the Tracelink panel
        cellImg.addEventListener( 'click', function() {
            var eventData = {
                sourceObject: {
                    uid: objectUid
                }
            };
            if ( arm0CreateTraceLink ) {
                arm0CreateTraceLink.addObjectToTracelinkPanel( eventData );
            }
        }, objectUid );
    }

    cellImg.innerHTML = imgSrc;
    containerElem.appendChild( cellImg );
};

const exports = {
    generateAwb0TraceLinkFlagRendererFn
};
export default exports;
