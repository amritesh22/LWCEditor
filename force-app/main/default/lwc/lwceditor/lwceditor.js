import { LightningElement, api, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import LightningAlert from 'lightning/alert';
import LightningConfirm from 'lightning/confirm';
import LightningPrompt from 'lightning/prompt';
import { loadStyle, loadScript } from 'lightning/platformResourceLoader';
import customresource from '@salesforce/resourceUrl/lwcEditorResources';
import getLwcComponents from '@salesforce/apex/LwcEditorController.getLwcComponents';
import getLwcComponentBody from '@salesforce/apex/LwcEditorController.getLwcComponentBody';
import updateLWCResource from '@salesforce/apex/LwcEditorController.updateLWCResource';
import createLWCResource from '@salesforce/apex/LwcEditorController.createLWCResource';
import createLWCComponent from '@salesforce/apex/LwcEditorController.createLWCComponent';
import deleteLWCResource from '@salesforce/apex/LwcEditorController.deleteLWCResource';
import deleteLWCComponent from '@salesforce/apex/LwcEditorController.deleteLWCComponent';
import geturls from '@salesforce/apex/LwcEditorController.baseURLS';

export default class LwcCodeEditor extends LightningElement {
    @track selectedComponent;
    
    lwcComponents = {};
    @track componentTree = [];
    @track opencomponents = [];
    expandlist = [];
    urls;
    scriptsLoadInit = false;

    renderedCallback() {
        if(!this.scriptsLoadInit) {
            this.scriptsLoadInit = true;
            this.fetchLwcComponents();
            Promise.all([
                loadStyle(this, customresource + '/customstyle.css')             
            ])
            .then(() => {
                console.log("All scripts and CSS are loaded. ");                      
            })
            .catch(error => {
                console.log("failed to load the styles and scripts");
            });   
        }
    }

    connectedCallback() {
        
        window.addEventListener("message", (message) => {
            
            if (message.origin !== this.urls.vfbaseurl) {
                console.log(`not expected origin  ${message.origin} !== ${this.urls.vfbaseurl}`);
                return;
            }        
                   
            //handle the message
            if(message.data.name === "lwceditor.requestcomponentbody") {
                this.loadcomponentbody(message.data.payload);
            }
            else if(message.data.name === "lwceditor.savecomponent") {
                this.savecomponent(message.data.payload);
            }
            else if(message.data.name === 'lwceditor.componentchanged') {
                this.handlecodechange(message.data.payload);
            }
        }, false);
    }

    disconnectedCallback() {}

    handlecodechange(compid) {        
        let opencomp = this.opencomponents.find((item) => { return item.fileid === compid });
        if(opencomp) opencomp.modified = true;
        
    }

    loadcomponentbody(compid) {
        getLwcComponentBody({ componentId: compid })
        .then((result) => {
            if (typeof result === 'string' && result.startsWith('error')) {
                console.log('error getting component body : ' + compid);
            } else {
                let record = JSON.parse(result);                
                let component = this.lwcComponents[compid];
                const msg = {
                    name: 'lwceditor.returncomponentbody',
                    payload: record
                }                                              
                const tabcontent = this.template.querySelector(`.slds-tabs_default__content[data-fileid="${compid}"]`);  
                component.iframe = tabcontent.querySelector('iframe');                
                component.iframe.contentWindow.postMessage(msg, this.urls.vfbaseurl);                
            }
        })
        .catch((error) => {
            console.error(error);
        });
    }

    savecomponent(data) {        
        let saving_text = 'Saving... ';
        let opencomp = this.opencomponents.find((item) => { return item.fileid === data.componentid });
        if(opencomp) opencomp.name = saving_text + opencomp.name;
        updateLWCResource({ componentId: data.componentid, filename: opencomp.name ,content: data.body, bundleId: opencomp.parentid })
        .then((result) => {
            if(opencomp) opencomp.name = opencomp.name.replace(saving_text, '');
            console.log(result);
            if (typeof result === 'string' && result.startsWith('error')) {                
                this.customalert('Save not successful', result, 'error');
            } else {                
                if(opencomp) opencomp.modified = false;
            }            
        })
        .catch((error) => {
            console.error(error);
        });
    }

    createcomponentresource( bundlename, bundleid) {       
        LightningPrompt.open({
            message: 'Enter file name with extension',            
            variant: 'headerless',
            defaultValue: bundlename
        }).then((name) => {
            if(name) {        
                let format = 'js';
                if(name) {
                    const lastIndex = name.lastIndexOf('.');
                    if (lastIndex > -1) {
                        format = name.substring(lastIndex+1, name.length);
                    }
                }
                createLWCResource({ filename: name, format: format, bundleId: bundleid, bundleName: bundlename })
                .then((result) => {
                    console.log(result);
                    if (typeof result === 'string' && result.startsWith('error')) {                        
                        this.customalert(`${name} creation failed`, result, 'error');               
                    } else {               
                        const callbackfunc = () => { 
                            setTimeout(() => {
                                if(result) {
                                    this.handleComponentClick(result);
                                }
                            }, 200);
                        }
                        this.fetchLwcComponents(callbackfunc);
                    }            
                })
                .catch((error) => {
                    console.error(error);
                });
            }
        });
    }

    createcomponentbundle() {
        LightningPrompt.open({
            message: 'Enter new LWC name',            
            variant: 'headerless'
        }).then((lwcname) => {
            if(lwcname) {
                createLWCComponent({ developerName: lwcname })
                .then((result) => {
                    console.log(result);
                    if (typeof result === 'string' && result.startsWith('error')) {                        
                        this.customalert(`LWC Component "${lwcname}"creation failed`, result, 'error');
                    } else {                        
                        const callbackfunc = () => { 
                            setTimeout(() => {
                                if(result) {
                                    this.template.querySelector('li[data-id="'+result+'"] ul.treeitem .clickableitem').click();                            
                                }
                            }, 200);
                        }
                        this.fetchLwcComponents(callbackfunc);
                    }            
                })
                .catch((error) => {
                    console.error(error);
                });
            }
        });
    }

    deletecomponentbundle(component) {        
        deleteLWCComponent({ compId: component.fileid })
        .then((result) => {
            console.log(result);
            if (typeof result === 'string' && result.startsWith('error')) {                
                this.customalert('LWC Component deletion failed', result, 'error');
            } else {                
                this.customalert('Success', `LWC Component "${component.name}" deleted`, 'success');
                if(component._children) {
                    for(let resourcefile of component._children) this.removeTab(resourcefile.fileid);
                }                 
                if(this.expandlist.includes(component.fileid)) this.expandlist = this.expandlist.filter(item => item !== component.fileid);
                this.fetchLwcComponents();
            }            
        })
        .catch((error) => {
            console.error(error);
        });
    }

    deletecomponentresource(component) {        
        deleteLWCResource({ compId: component.fileid })
        .then((result) => {
            console.log(result);
            if (typeof result === 'string' && result.startsWith('error')) {                
                this.customalert('File deletion failed', result, 'error');
            } else {                
                this.customalert('Success', `${component.name} deleted`, 'success');
                this.removeTab(component.fileid);
                this.fetchLwcComponents();
            }            
        })
        .catch((error) => {
            console.error(error);
        });
    }

    handleComponentClick(compid) {        
        if(this.selectedComponent===compid) return;   
        let component = this.lwcComponents[compid];
        if(component) {
            this.openTab(component);            
        }
    }

    openTab(component) {       
        this.selectedComponent = component.fileid;
        let checkifopen = this.opencomponents.find((item) => {
            return item.fileid === component.fileid;
        });        
        if(!checkifopen) {
            this.opencomponents.push(component);      
        }        
        for(let opncomp of this.opencomponents) {
            if(component.fileid===opncomp.fileid) opncomp.active = true;
            else opncomp.active = false;
        }               
        this.markasSelected(component.fileid);                 
    }

    markasSelected(compid) {
        for(let bundle of this.componentTree) {
            for(let item of bundle._children) {
                if(item.fileid===compid) {
                    item.active=true;
                    if(!bundle.expanded) bundle.expandtoggle(); //bundle.expanded = true; 
                    const itemelem = this.template.querySelector('.slds-tree__item[data-id="'+item.fileid+'"]');
                    if(itemelem) {
                        try{
                            itemelem.scrollIntoViewIfNeeded();
                        }catch(err){
                            itemelem.scrollIntoView({ behavior: "instant", block: "center" }); 
                        }                        
                    }
                }
                else item.active=false;
            }
        }        
    }

    removeTab(compid) { 
        let component = this.lwcComponents[compid];
        if(component) {               
            let indextoremove;
            this.opencomponents.forEach((item, index) => {
                if(item.fileid === component.fileid) {
                    indextoremove = index;                                     
                }
            });            
            if(indextoremove!=null && indextoremove!=undefined) {
                component.active = false;                                
                if(indextoremove==0 && this.opencomponents.length==1){
                    this.opencomponents = [];
                    this.selectedComponent = null;
                } else {
                    const fileidremoved = component.fileid;
                    const currentcomponent = this.selectedComponent;
                    let temp = [...this.opencomponents];
                    temp.splice(indextoremove, 1);
                    this.opencomponents = temp;                    
                    if(currentcomponent==fileidremoved) {                    
                        if(indextoremove>0 && indextoremove==this.opencomponents.length) { //last in array
                            indextoremove--;
                        }
                        let comp = this.opencomponents[indextoremove];                        
                        this.openTab(comp);
                    }        
                }        
            }     
        }   
    }

    handletabclick(event) {
        event.preventDefault();        
        if(!event.target) return;        
        let closebtn = event.target.closest(".slds-tabs_default__item .slds-button");
        if(closebtn) return;
        const tabelem = event.target.closest(".slds-tabs_default__item");
        if(tabelem) {            
            let component = this.lwcComponents[tabelem.dataset.fileid];
            this.openTab(component);
        }
    }

    closetab(event) {        
        event.preventDefault();
        if(!event.target) return;        
        let closebtn = event.target.closest(".slds-tabs_default__item .slds-button");
        if(closebtn) {
            let component = this.lwcComponents[closebtn.dataset.fileid];
            this.removeTab(component.fileid);
        }
    }

    @wire(geturls)
    wiredurls({ error, data }) {
        if (data) {            
            this.urls = data;
        }
        if(error) {
            console.error(error);
        }
    }

    fetchLwcComponents(callback) {
        getLwcComponents()
        .then((data) => {
            if (typeof data === 'string' && data.startsWith('error')) {
                this.customalert('Error fetching lwc component list', data, 'error');
            } else {
                let result = data;                
                this.lwcComponents = {};
                this.componentTree = [];                
                let index = 0;
                result.forEach(bundle => {                    
                    let folderobj = {
                        fileid: bundle.Id, 
                        name: bundle.DeveloperName,                            
                        isfolder: true,
                        index: index++
                    };
                    this.lwcComponents[bundle.Id] = {...folderobj};

                    folderobj.expanded = this.expandlist.includes(folderobj.fileid);
                    folderobj.expandtoggle = () => {                                                                                     
                        this.componentTree[folderobj.index].expanded = !this.componentTree[folderobj.index].expanded; 
                        if(this.componentTree[folderobj.index].expanded) {
                            if(!this.expandlist.includes(folderobj.fileid)) this.expandlist.push(folderobj.fileid);
                        } else {
                            this.expandlist = this.expandlist.filter(bundleid => bundleid !== folderobj.fileid);
                        }
                    }
                    folderobj.createlwcfile = () => {                            
                        this.createcomponentresource(folderobj.name, folderobj.fileid);
                    }
                    folderobj.deletelwcbundle = async () => {                            
                        const confirmation = await LightningConfirm.open({
                            message: 'Do you really want to delete the LWC component ?',
                            variant: 'headerless'
                        });
                        if(confirmation) this.deletecomponentbundle(folderobj);
                    }
                    folderobj._children = [];

                    if(bundle.lstLWCResources) {
                        let childindex = 0;
                        bundle.lstLWCResources.forEach(component => {
                            let resourcename = component.FilePath.substring(component.FilePath.lastIndexOf('/') + 1);
                            let childobj = {
                                parentid: bundle.Id,
                                fileid: component.Id,
                                name: resourcename,
                                format: component.Format,
                                isfolder: false,
                                index: childindex++,
                                active: this.selectedComponent ? this.selectedComponent===component.Id : false,
                                filepath: component.FilePath,                                                                        
                                codeeditorurl: `/apex/codeEditor?component=${component.Id}`
                            };

                            if(component.FilePath) {
                                if(component.FilePath.endsWith('.js')) childobj.iconname = 'standard:javascript_button';
                                if(component.FilePath.endsWith('.html')) childobj.iconname = 'doctype:html';
                                if(component.FilePath.endsWith('.css')) childobj.iconname = 'doctype:stypi';
                                if(component.FilePath.endsWith('.xml')) childobj.iconname = 'doctype:xml';
                                if(component.FilePath.endsWith('.svg')) childobj.iconname = 'doctype:webex';
                                if(component.FilePath.endsWith('.json')) childobj.iconname = 'doctype:unknown';
                            }

                            this.lwcComponents[component.Id] = {...childobj};

                            childobj.openresource = () => { this.handleComponentClick(childobj.fileid) }
                            childobj.deletelwcfile = async () => {
                                
                                const confirmation = await LightningConfirm.open({
                                    message: 'Do you really want to delete the file ?',
                                    variant: 'headerless'
                                });
                                if(confirmation) this.deletecomponentresource(childobj);
                            }
                            
                            folderobj._children.push(childobj);                                
                        });
                    }
                    this.componentTree.push(folderobj);    
                });                
            }         
            if(this.selectedComponent) this.markasSelected(this.selectedComponent);
            if(callback && typeof callback === 'function') callback();
        })
        .catch((error) => {            
            this.customalert('Error fetching lwc component list', error.toString(), 'error');
        });    
    }

    resizer;
    canMove = false;

    handleOnMouseDown(event) {
        event.preventDefault();
        this.resizer = event.currentTarget;
        delete this.resizer._clientX
        this.canMove = true;
    }

    handleOnMouseMove(event) {
        event.preventDefault();
        if (this.canMove) {
            const clientX = event.clientX;
            const deltaX = clientX - (this.resizer._clientX || clientX);
            this.resizer._clientX = clientX;
            const { previousElementSibling, nextElementSibling } = this.resizer
            // LEFT
            if (deltaX < 0) {
                const width = Math.round(parseInt(window.getComputedStyle(previousElementSibling).width) + deltaX)
                previousElementSibling.style.flex = `0 ${width < 10 ? 0 : width}px`
                nextElementSibling.style.flex = "1 0"
            }
            // RIGHT
            else if (deltaX > 0) {
                const width = Math.round(parseInt(window.getComputedStyle(nextElementSibling).width) - deltaX)
                nextElementSibling.style.flex = `0 ${width < 10 ? 0 : width}px`
                previousElementSibling.style.flex = "1 0"
            }
        }
    }

    handleOnMouseUp(event) {
        event.preventDefault();
        this.canMove = false;
    }
    
    customalert(title, msg, variant) {
        LightningAlert.open({
            message: msg,
            theme: variant, 
            label: title
        });
    }

}