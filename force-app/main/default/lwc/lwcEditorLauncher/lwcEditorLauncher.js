import { LightningElement } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';

export default class lwcEditorLauncher extends NavigationMixin(LightningElement) {

    openLwcEditor() {
        //window.open('/c/LwcEditorApp.app', '_blank');
        const url = '/c/LwcEditorApp.app';
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: {
                url: url
            }
        },
        false // Open in a new tab
        );
    }
}