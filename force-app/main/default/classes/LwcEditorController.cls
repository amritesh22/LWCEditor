public with sharing class LwcEditorController {
    
    public static string BASEURL { get { return URL.getOrgDomainUrl().toExternalForm(); } }
    public static string VFBASEURL { get { return 'https://'+DomainCreator.getVisualforceHostname(null); } }
    public static string LWCBASEURL { get { return 'https://'+DomainCreator.getLightningHostname(); } }
    
    private static final String toolingapi = '/services/data/v58.0/tooling';
    private static final String subpath_query = '/query?q=';
    private static final String subpath_lwcresource = '/sobjects/LightningComponentResource';
    private static final String subpath_lwcbundle = '/sobjects/LightningComponentBundle';
    
    
    public LwcEditorController(){}
    
    @AuraEnabled(cacheable=true)
    public static Map<String, String> baseURLS() {
        Map<String, String> mapUrls = new Map<String, String>();
        mapUrls.put('mydomainurl', BASEURL);
        mapUrls.put('vfbaseurl', VFBASEURL);
        mapUrls.put('lwcbaseurl', LWCBASEURL);
        return mapUrls;
    }
    
    public static Map<String, wrapBundle> getLwcBundles() {
        String query = 'SELECT Id, DeveloperName FROM LightningComponentBundle WHERE ManageableState=\'unmanaged\'';
        String endpoint = BASEURL + toolingapi + subpath_query + EncodingUtil.urlEncode(query, 'UTF-8');   
        String sessionId = getSessionId();
        HttpResponse res = makeCallout(endpoint, 'GET', null, new Map<String, String>{ 'Authorization' => 'Bearer ' + sessionId} );        
        String resBody = res.getBody();        
        Map<String, Object> jsonMap =  (Map<String, Object>) JSON.deserializeUntyped(resBody);
        List<wrapBundle> lstBundle = (List<wrapBundle>) JSON.deserialize(JSON.serialize(jsonMap.get('records')), List<wrapBundle>.class);
        Map<String, wrapBundle> mapBundle = new Map<String, wrapBundle>();
        for(wrapBundle wB : lstBundle) {
            mapBundle.put(wB.Id, wB);
        }
        return mapBundle;
    }
    
    @AuraEnabled
    public static Object getLwcComponents() {
        try{
            Map<String, wrapBundle> mapBundle = getLwcBundles();
            if(mapBundle.isEmpty()) throw new customException('not able to fetch lightning web bundles');
            String endpoint;
            String query = 'SELECT Id, LightningComponentBundleId, LightningComponentBundle.DeveloperName, FilePath, Format FROM LightningComponentResource WHERE ManageableState=\'unmanaged\' ORDER BY LightningComponentBundle.DeveloperName, FilePath';
            endpoint = BASEURL + toolingapi + subpath_query + EncodingUtil.urlEncode(query, 'UTF-8');      
            String sessionId = getSessionId();            
            HttpResponse res = makeCallout(endpoint, 'GET', null, new Map<String, String>{ 'Authorization' => 'Bearer ' + sessionId} );            
            String resBody = res.getBody();                    
            Map<String, Object> jsonMap =  (Map<String, Object>) JSON.deserializeUntyped(resBody);
            List<wrapResource> lstResources = (List<wrapResource>) JSON.deserialize(JSON.serialize(jsonMap.get('records')), List<wrapResource>.class);
            
            for(wrapResource wR : lstResources) {
                if(!mapBundle.containsKey(wR.LightningComponentBundleId)) continue;
                wrapBundle wB = mapBundle.get(wR.LightningComponentBundleId);                    
                if(wB.lstLWCResources==null) wB.lstLWCResources = new List<wrapResource>();
                wB.lstLWCResources.add(wR);
            }
            Map<String, String> mapBundleName2Id = new Map<String, String>();
            for(wrapBundle wB : mapBundle.values()) {
                mapBundleName2Id.put(wB.DeveloperName, wB.Id);
            }
            List<String> lstBundleName = new List<String>(mapBundleName2Id.keySet());
            lstBundleName.sort();
            List<wrapBundle> lstBundle = new List<wrapBundle>();
            for(String bName : lstBundleName) {
                lstBundle.add(mapBundle.get(mapBundleName2Id.get(bName)));
            }
            return lstBundle;            
        } catch(Exception ex) {
            System.debug('Error: ' + ex.getMessage() + ex.getStackTraceString());    
            return 'error: ' + ex.getMessage();
        }        
    }
    
    @AuraEnabled
    public static Object getLwcComponentBody(String componentId) {
        try{                         
            String endpoint = BASEURL + toolingapi + subpath_lwcresource + '/' + componentId;
            String sessionId = getSessionId();            
            HttpResponse res = makeCallout(endpoint, 'GET', null, new Map<String, String>{ 'Authorization' => 'Bearer ' + sessionId} );
            String resBody = res.getBody();                  
            return resBody;            
        } catch(Exception ex) {
            System.debug('Error: ' + ex.getMessage() + ex.getStackTraceString()); 
            return 'error: ' + ex.getMessage();
        }                
    }
    
    @AuraEnabled
    public static String updateLWCResource(String componentId, String filename, String content, String bundleId) {   
        try{   
            String endpoint = BASEURL + toolingapi + subpath_lwcresource + '/' + componentId;
            String sessionId = getSessionId();  
            
            JSONGenerator gen = JSON.createGenerator(true);
            gen.writeStartObject();
            gen.writeFieldName('Source');
            gen.writeString(content);
            gen.writeEndObject();
            
            String body = gen.getAsString();               
            HttpResponse res = makeCallout(endpoint, 'PATCH', body, new Map<String, String>{ 'Authorization' => 'Bearer ' + sessionId} );  
            
            if(filename.endsWith('.js-meta.xml')) {
                Boolean isExposed = false;                
                if(content.containsIgnoreCase('<isExposed>true</isExposed>')) isExposed = true;
                
                String patternStr = '<target>(.*?)</target>';
                Pattern p = Pattern.compile(patternStr);
                Matcher m = p.matcher(content);                
                List<String> matches = new List<String>();                                
                while (m.find()) { matches.add(m.group(1)); }                
                
                String bundleBody = '{"Metadata": { "isExposed": '+isExposed+', "targets": {"target": '+JSON.serialize(matches)+'} }}';
                if(String.isNotBlank(bundleBody)) updateLWCBundle(bundleId, bundleBody);
            }
            
            return 'success';                       
        } catch(Exception ex) {
            System.debug('Error: ' + ex.getMessage() + ex.getStackTraceString()); 
            return 'error: '+ ex.getMessage();
        }        
    }
    
    @AuraEnabled
    public static String updateLWCBundle(String bundleId, String body) {   
        try{   
            String endpoint = BASEURL + toolingapi + subpath_lwcbundle + '/' + bundleId;
            String sessionId = getSessionId();  
                                    
            HttpResponse res = makeCallout(endpoint, 'PATCH', body, new Map<String, String>{ 'Authorization' => 'Bearer ' + sessionId} );        
            return 'success';                      
        } catch(Exception ex) {
            System.debug('Error: ' + ex.getMessage() + ex.getStackTraceString()); 
            return 'error: '+ ex.getMessage();
        }        
    }
        
    @AuraEnabled
    public static String createLWCResource(String filename, String format, String bundleId, String bundleName) {   
        try{   
            String endpoint = BASEURL + toolingapi + subpath_lwcresource;
            String sessionId = getSessionId();              
            String content;
            if(format=='html') content = '<template>\n\n</template>';
            if(format=='js' && filename.endsWith('.js')) content = 'import { LightningElement } from \'lwc\';\n\nexport default class '+bundleName+' extends LightningElement {}';
            if(format=='js' && filename.endsWith('.js-meta.xml')) content = '<?xml version="1.0" encoding="UTF-8"?>\n<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">\n    <apiVersion>58.0</apiVersion>\n    <isExposed>false</isExposed>\n</LightningComponentBundle>';            
            if(format=='css') content = 'div{}';            
            
            String fpath = 'lwc/'+bundleName+'/'+filename;
                        
            JSONGenerator gen = JSON.createGenerator(true);            
            gen.writeStartObject();
            gen.writeStringField('Format', format);
            gen.writeStringField('FilePath', fpath);            
            gen.writeStringField('LightningComponentBundleId', bundleId);
            if(String.isNotBlank(content)) {
            	gen.writeFieldName('Source');
            	gen.writeString(content);
            }
            gen.writeEndObject();
            
            String body = gen.getAsString();               
            HttpResponse res = makeCallout(endpoint, 'POST', body, new Map<String, String>{ 'Authorization' => 'Bearer ' + sessionId} );        
            Integer status = res.getStatusCode();
            String responseBody = res.getBody();
            String resourceId;
            if(responseBody.contains('id')) {                
                Map<String, Object> jsonMap = (Map<String, Object>) JSON.deserializeUntyped(responseBody);
                resourceId = (String) jsonMap.get('id');
            }
            return resourceId;                  
        } catch(Exception ex) {
            System.debug('Error: ' + ex.getMessage() + ex.getStackTraceString()); 
            return 'error: '+ ex.getMessage();
        }        
    }
    
    @AuraEnabled
    public static string createLWCComponent(String developerName) {
        try{   
            String endpoint = BASEURL + toolingapi + subpath_lwcbundle;
        	JSONGenerator gen = JSON.createGenerator(true);
            gen.writeStartObject();
            gen.writeStringField('FullName', developerName);                        
            gen.writeFieldName('Metadata');
            gen.writeStartObject();
            gen.writeNumberField('apiVersion', 58);
            gen.writeStringField('masterLabel', developerName);
            gen.writeEndObject();
            gen.writeEndObject();
                        
            String body = gen.getAsString();                  
            HTTPResponse res = makeCallout(endpoint, 'POST', body, new Map<String, String>{ 'Authorization' => 'Bearer ' + getSessionId()} );        
            String responseBody = res.getBody();
            Integer status = res.getStatusCode();            
            String bundleId;
                        
            if(responseBody.contains('id')) {                
                Map<String, Object> jsonMap = (Map<String, Object>) JSON.deserializeUntyped(responseBody);
                bundleId = (String) jsonMap.get('id');
            }
            
            if(String.isBlank(bundleId)) {
                throw new customException('component created but file creation failed');                
            }
			                        
            String htmlfname = developerName+'.html';
            String jsfname = developerName+'.js';
            String xmlfname = developerName+'.js-meta.xml';
            String cssfname = developerName+'.css';
            
            String jscompresult = createLWCResource(jsfname, 'js', bundleId, developerName);
            String htmlcompresult = createLWCResource(htmlfname, 'html', bundleId, developerName);            
            String xmlcompresult = createLWCResource(xmlfname, 'js', bundleId, developerName);
            String csscompresult = createLWCResource(cssfname, 'css', bundleId, developerName);  
            
            return bundleId;
        
        } catch(Exception ex) {
            System.debug('Error: ' + ex.getMessage() + ex.getStackTraceString()); 
            return 'error: '+ ex.getMessage();
        }  
    } 
    
    @AuraEnabled
    public static String deleteLWCResource(String compId) {   
        try{   
            String endpoint = BASEURL + toolingapi + subpath_lwcresource + '/' + compId;
            String sessionId = getSessionId();                
            HttpResponse res = makeCallout(endpoint, 'DELETE', null, new Map<String, String>{ 'Authorization' => 'Bearer ' + sessionId} );        
            Integer status = res.getStatusCode();
            String responseBody = res.getBody();
            return 'success';                  
        } catch(Exception ex) {
            System.debug('Error: ' + ex.getMessage() + ex.getStackTraceString()); 
            return 'error: '+ ex.getMessage();
        }        
    }
    
    @AuraEnabled
    public static String deleteLWCComponent(String compId) {   
        try{   
            String endpoint = BASEURL + toolingapi + subpath_lwcbundle + '/' + compId;
            String sessionId = getSessionId();                
            HttpResponse res = makeCallout(endpoint, 'DELETE', null, new Map<String, String>{ 'Authorization' => 'Bearer ' + sessionId} );        
            Integer status = res.getStatusCode();
            String responseBody = res.getBody();
            return 'success';                  
        } catch(Exception ex) {
            System.debug('Error: ' + ex.getMessage() + ex.getStackTraceString()); 
            return 'error: '+ ex.getMessage();
        }        
    }
            
    private static HttpResponse makeCallout(String endpoint, String method, String body, Map<String, String> mapHeaders ) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint(endpoint);
        req.setMethod(method);
        if(mapHeaders!=null){
            for(String hdrKey : mapHeaders.keySet()) {
                req.setHeader(hdrKey, mapHeaders.get(hdrKey));
            }
        }
        req.setHeader('Content-Type', 'application/json');
        if(String.isNotBlank(body)) {
            req.setBody(body);
        }
        System.debug('endpoint : ' + endpoint);
        System.debug('headers : ' + mapHeaders==null ? '' : String.valueOf(mapHeaders));
        System.debug('request body : ' + body);
        Http http = new Http();
        HttpResponse res = http.send(req);
        String resBody = res.getBody();
        System.debug('response: statuscode - ' + res.getStatusCode() + '. status - ' + res.getStatus());     
        System.debug('response body : ' + resBody); 
        Integer status = res.getStatusCode();
        if(status>=200 && status<300) {  }
        else {
            String msg = 'callout failed. statuscode: ' + res.getStatus() + '. status: ' + res.getStatus();
            if(String.isNotBlank(resBody)) msg = resBody;
            System.debug(msg);
            throw new customException(msg);
        }
        return res;        
    }
        
    static String session_Id;
    private static string getSessionId() {
        if(String.isBlank(session_Id)) {
            session_Id = Page.GenSessionId.getContent().toString();
            session_Id = session_Id.substringBetween('Start_Of_Session_Id', 'End_Of_Session_Id');
        }
        return session_Id;
    }
    
    public class wrapBundle {
        @AuraEnabled public string Id;
        @AuraEnabled public String DeveloperName;
        @AuraEnabled public List<wrapResource> lstLWCResources;
    }
    
    public class wrapResource {
        @AuraEnabled public string Id;
        @AuraEnabled public string FilePath;
        @AuraEnabled public string Format;
        @AuraEnabled public string LightningComponentBundleId;
    }
    public class customException extends Exception {}
}