// Copyright (c) 2022 Siemens

/**
 * @module js/Ase0FloatingWindowBreadcrumbHandler
 */
import _ from 'lodash';
import $ from 'jquery';
import eventBus from 'js/eventBus';
import navigateBreadCrumbService from 'js/aw.navigateBreadCrumbService';
import AwStateService from 'js/awStateService';
import logger from 'js/logger';
import ase0FloatingWindowHandler from 'js/Ase0FloatingWindowHandler';

var exports = {};

/**
 * Functionality to trigger after selecting bread crumb
 *
 * @param {Object} data - data
 * @param {Object} crumb - selected bread crumb object
 */
export let onSelectCrumb = function( data, crumb ) {
    if( AwStateService.instance.params.breadcrumbId ) {
        var wabc = AwStateService.instance.params.breadcrumbId.split( '^' );
        var uidIdx = wabc.indexOf( crumb.scopedUid );
        AwStateService.instance.go( '.', {
            wabc: uidIdx !== -1 ? wabc.slice( 0, uidIdx + 1 ).join( '^' ) : null
        } );
    }
    eventBus.publish( 'awFloatGraphPopup.getAssociatedDiagrams', {
        object: crumb.data,
        selectedCrumb: crumb
    } );
};

/**
 * Build fw breadrumb
 * @param {Object} context context
 * @param {Object} breadcrumbconfig breadcrumb config id
 * @returns {Promise} promise with breadcrumb structure
 */
export function buildFwBreadcrumb( data, context, breadcrumbconfig ) {
    if( breadcrumbconfig ) {
        var provider = {
            crumbs: []
        };
        var promise = navigateBreadCrumbService.readUrlForCrumbs( breadcrumbconfig.id, true );
        promise.then( function( idList ) {
            if( idList && !_.isEmpty( idList ) ) {
                var crumbsList = [];
                $.each( idList, function( key, val ) {
                    if( val && val.props.object_string &&
                        val.props.object_string.uiValues[ 0 ] ) {
                        var crumb = navigateBreadCrumbService.generateCrumb(
                            val.props.object_string.uiValues[ 0 ], true, false, key );
                        crumbsList.push( crumb );
                    } else {
                        logger.error( 'Cannot find object_string in modelObject' );
                    }
                } );
                if( crumbsList.length > 0 ) {
                    crumbsList[ crumbsList.length - 1 ].showArrow = false;
                    crumbsList[ crumbsList.length - 1 ].selectedCrumb = true;
                }
                provider.crumbs = crumbsList;
            } else {
                var displayName = '';

                if( context.object.props.awb0UnderlyingObject ) {
                    displayName = context.object.props.awb0UnderlyingObject.uiValues[ '0' ];
                } else if( context.object.props.awp0CellProperties ) {
                    displayName = context.object.props.awp0CellProperties.uiValues[ '0' ];
                }
                var newCrumb = {
                    clicked: false,
                    displayName: displayName,
                    selectedCrumb: true,
                    width: 200,
                    data: context.object,
                    scopedUid: context.object.uid,
                    onCrumbClick: ( crumb ) => onSelectCrumb( data, crumb )
                };

                if( provider.crumbs.length > 0 ) {
                    var lastCrumb = _.last( provider.crumbs );

                    if( lastCrumb && lastCrumb.displayName === displayName ) {
                        return;
                    }
                }

                _.forEach( provider.crumbs, function( crumb ) {
                    crumb.selectedCrumb = false;
                    crumb.clicked = false;
                } );
                newCrumb.showArrow = true;
                provider.crumbs.push( newCrumb );
                ase0FloatingWindowHandler.checkBreadcrumbOverflow( data, breadcrumbconfig, provider );
            }
            var lastCrumb = provider.crumbs[ provider.crumbs.length - 1 ];
            lastCrumb.selectedCrumb = true;
        } );
        return provider;
    }
}

/**
 * Ase0FloatingWindowBreadcrumbHandler factory
 */

// Angular JS.

// DeclViewModel loaders.

// View Model Service.

// Data Management Service.

// Command Panel Service.

export default exports = {
    buildFwBreadcrumb,
    onSelectCrumb
};
