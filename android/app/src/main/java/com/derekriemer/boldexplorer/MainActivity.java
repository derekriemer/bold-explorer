package com.derekriemer.boldexplorer;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.derekriemer.boldexplorer.HeadingPlugin;
import com.equimaps.capacitor_background_geolocation.BackgroundGeolocation;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    // Register custom Capacitor plugins BEFORE calling super.onCreate so the bridge includes them
    registerPlugin(HeadingPlugin.class);
    registerPlugin(BackgroundGeolocation.class);
    super.onCreate(savedInstanceState);
  }
}
