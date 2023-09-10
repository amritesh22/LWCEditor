<aura:application extends="force:slds">
    <aura:handler name="init" value="{!this}" action="{!c.doInit}"/>
    <lightning:notificationsLibrary aura:id="notificationLibrary"/>
    <c:lwceditor />
</aura:application>