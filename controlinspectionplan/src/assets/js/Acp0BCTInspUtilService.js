// Copyright (c) 2022 Siemens

/**
 * @module js/Acp0BCTInspUtilService
 */
import soaService from 'soa/kernel/soaService';
import preferenceService from 'soa/preferenceService';
import appCtxService from 'js/appCtxService';
import { loadIPXML } from '@swf/bct-inspector-viewer';

const PREF_DATASETS = 'AW_BCT_INSPECTOR_COMPARE_DATASETS';
const PREFERENCE_NAMES = [ PREF_DATASETS ];
var _data = undefined;

const typePolicy = ( name, props ) => ( {
    name,
    properties: props.map( prop => ( {
        name: prop
    } ) )
} );

var exports = {};

class Acp0BCTInspUtilService {
    constructor() {
        // Customization point, can be overriden by client application
        this.ticketToUrl = ( ticket, preferences ) => `fms/fmsdownload/?ticket=${ticket}`;
    }

    reset() {
        delete this.preferencesPromise;
    }

    get preferencesPromise() {
        const promise = preferenceService.getMultiStringValues( PREFERENCE_NAMES ).then( parsePreferenceResponse ).catch( error => {
            throw new Error( _data.i18n.Acp0PrefNotLoaded + error );
        } );
        Object.defineProperty( this, 'preferencesPromise', {
            value: promise,
            configurable: true
        } );
        return promise;
    }
    /**
     * Executes an Inspector view call for a selected object
     *
     * @param selectedUid the uid of the selected object
     * @returns {Promise<object>}
     */
    async getPartAttachmentProject( selectedUid, data ) {
        _data = data;
        const preferences = await this.preferencesPromise;
        const [ attachments ] = await this._getItemRevisionAttachments( {
            itemRevisionUids: [ selectedUid ],
            datasetTypes: preferences.relations.map( relation => relation.datasetType ),
            namedRefTypes: preferences.relations.map( relation => relation.namedRefType )
        } );

        if ( attachments.length === 0 ) {
            throw new Error( _data.i18n.Acp0NoAttachmentMatchingPref );
        }
        const attachment = bestAttachment( attachments, preferences );
        const project = await this.loadProjectFromAttachment( attachments );
        return {
            title: attachment.name,
            project
        };
    }

    /**
     * To prepare reduce Ipxml which reuired for back support of import PMI process
     * @param itemId {String}
     * @param itemRevisionId {String}
     * @param characteristics  {Map<*,Map>}
     * @returns {Map<*, String>}
     */

    async characteristicToIPXML( _ref5 ) {
        let {
            itemId,
            itemRevisionId,
            characteristics
        } = _ref5;
        const escape = str => str.toString().replace( /[<>&]/g, i => `&#${i.charCodeAt( 0 )};` );

        const result = new Map();
        characteristics.forEach( ( characteristic, key ) => {
            const propertyText = [];
            //As BCT component(19.5.0) has changes on selection data need to add char uid as part of characteristics props. As its important for creation of reduced ipxml.
            characteristic.props.set( 'BCT_CHX_UID', characteristic.id );

            for ( const [ name, value ] of characteristic.props ) {
                propertyText.push( `    <col name="${name}">${escape( value )}</col>` );
            }
            result.set( key, `<?xml version="1.0" encoding="UTF-8"?>
        <SPStruct>
        <data>
          <row>
            <col name="K1001">${itemId}</col>
            <col name="K1004">${itemRevisionId}</col>
        ${propertyText.join( '\n' )}
          </row>
        </data>
        </SPStruct>` );
        } );
        return result;
        Object.defineProperty( this, 'characteristicToIPXML', {
            value: result,
            configurable: true
        } );
    }

    /**
     * @param itemRevisionUids {Array<String>}
     * @param datasetTypes {Array<String>}
     * @param namedRefTypes {Array<String>}
     * @return {Object}
     */
    async _getItemRevisionAttachments( _ref ) {
        let {
            itemRevisionUids,
            datasetTypes,
            namedRefTypes
        } = _ref;
        const response = await soaService.post( 'Core-2008-06-DataManagement', 'getItemAndRelatedObjects', {
            infos: itemRevisionUids.map( itemRevisionUid => ( {
                itemInfo: {},
                revInfo: {
                    uid: itemRevisionUid,
                    processing: 'Ids',
                    useIdFirst: false
                },
                datasetInfo: {
                    filter: {
                        processing: 'All',
                        relationFilters: datasetTypes.map( datasetType => ( {
                            datasetTypeName: datasetType
                        } ) )
                    },
                    namedRefs: namedRefTypes.map( namedRefType => ( {
                        namedReference: namedRefType,
                        ticket: true
                    } ) )
                }
            } ) )
        }, {
            types: [ typePolicy( 'Dataset', [ 'last_mod_date', 'object_name' ] ) ]
        } );
        const modelData = response.ServiceData.modelObjects;
        return response.output.map( output => {
            const datasets = output.itemRevOutput[0].datasetOutput;
            let attachments = [];
            datasets.forEach( dataset => {
                const datasetModel = modelData[dataset.dataset.uid];
                const datasetName = datasetModel.props.object_name.dbValues[0];
                const lastModified = new Date( datasetModel.props.last_mod_date.dbValues[0] );
                const namedReferences = dataset.namedReferenceOutput.map( namedReference => ( {
                    datasetUid: dataset.dataset.uid,
                    lastModified,
                    name: datasetName,
                    namedRefType: namedReference.namedReferenceName,
                    ticket: namedReference.ticket
                } ) );
                attachments = attachments.concat( namedReferences );
            } );
            return attachments;
        } );
        Object.defineProperty( this, '_getItemRevisionAttachments', {
            value: response,
            configurable: true
        } );
    }

    /**
     * Load the attachments to render 2D/3D drawing
     * @param attachment {Object}
     * @returns {Project}
     */
    async loadProjectFromAttachment( attachments ) {
        const preferences = await this.preferencesPromise;
        let responseIpxmlText;
        let responseJtUrl;
        let relation;
        const promisesToAwait = new Map();
        for( let attachment of attachments ) {
            relation = preferences.relations.find( item => item.namedRefType === attachment.namedRefType );
            const response = fetch( this.ticketToUrl( attachment.ticket, preferences ) );
            promisesToAwait.set( relation.fileType.toLowerCase(), response );
        }
        const ipxmlResponse = await promisesToAwait.get( 'ipxml' );
        const jtResponse = await promisesToAwait.get( 'jt' );
        if( ipxmlResponse ) {
            responseIpxmlText = await ipxmlResponse.text();
        }
        if( jtResponse ) {
            responseJtUrl = await jtResponse.url;
        }
        appCtxService.registerCtx( 'fileTypeOfProject', relation.fileType.toUpperCase() );
        return callLoadIPXML( responseIpxmlText, responseJtUrl );
    }
}

/**
 * To call loadIPXML function by handeling error messages.
 *
 * @param responseIpxmlText attached IPXML
 * @param responseJtUrl JT url if attached
 * @returns Project Object to render the drawing
 */
function callLoadIPXML( responseIpxmlText, responseJtUrl ) {
    try{
        return loadIPXML( responseIpxmlText, responseJtUrl );
    } catch( error ) {
        switch ( error.message ) {
            case 'IPXML with multiple JT models are not supported':
                appCtxService.ctx.renderingErrorMessage = _data.i18n.Z_3DRenderingErrorIpxmlWithMultiJTModel;
                break;
            case 'IPXML does not contain JT model-related data':
                appCtxService.ctx.renderingErrorMessage = _data.i18n.Z_3DRenderingErrorInvalidIpxml;
                break;
            case 'IPXML requires a JT model':
                appCtxService.ctx.renderingErrorMessage = _data.i18n.Z_3DRenderingErrorAttachJT;
                break;
            case 'File is not in IPXML format':
                appCtxService.ctx.renderingErrorMessage = _data.i18n.Z_3DRenderingErrorInvalidIpxml;
                break;
            default:
        }
        return;
    }
}

/**
 * Stores a set of preferences needed to view / compare drawings
 *
 * @param response the promise response returned by the preference service after a query
 * @returns {Promise<{ fmsUrl: string, relations: Map}>}
 */


function parsePreferenceResponse( response ) {
    const missing = PREFERENCE_NAMES.filter( name => !response[name] );

    if ( missing.length > 0 ) {
        throw new Error( _data.i18n.Acp0NotGetReqPreference + missing.join( ', ' ) );
    }

    const relations = [];
    const relationConfig = get( response, PREF_DATASETS ) || [];
    relationConfig.forEach( ( entry, lineIdx ) => {
        const [ datasetType, namedRefType, fileType ] = entry.split( ':' );

        if ( !datasetType || !namedRefType || !fileType ) {
            console.error( `${PREF_DATASETS}, line ${lineIdx + 1} [${entry}] is invalid` );
            return;
        }

        relations.push( Object.freeze( {
            datasetType,
            namedRefType,
            fileType
        } ) );
    } );
    return Object.freeze( {
        relations: Object.freeze( relations )
    } );
}

function bestAttachment( attachments, preferences ) {
    const relations = preferences.relations;

    const attachmentWeight = attachment => relations.findIndex( relation => relation.namedRefType === attachment.namedRefType );

    attachments.sort( ( attachmentA, attachmentB ) => attachmentWeight( attachmentA ) - attachmentWeight( attachmentB ) );
    return attachments[0];
}

/** Safely query an object path
 * @param node {object} Starting object.
 * @param path {string} Dot-separated list of path components.
 * @returns {*} Result, or first falsy entity along the path.
 */
function get( node, path ) {
    const parts = path.split( '.' );
    const partsLen = parts.length;

    for ( let i = 0; node && i < partsLen; ++i ) {
        node = node[parts[i]];
    }

    return node;
}

const acp0BCTInspInstance = new Acp0BCTInspUtilService();
export default acp0BCTInspInstance;

/**
 * Since this module can be loaded as a dependent DUI module we need to return an object indicating which service
 * should be injected to provide the API for this module.
 */
export let moduleServiceNameToInject = 'Acp0BCTInspUtilService';
