// android/src/main/java/your/pkg/HeadingPlugin.kt
package com.derekriemer.boldexplorer

import android.content.Context
import android.hardware.GeomagneticField
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.Location
import android.os.SystemClock
import android.view.Surface
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import android.util.Log

private fun normalize0to360(deg: Double): Double {
  var d = deg % 360.0
  if (d < 0) d += 360.0
  return d
}

@CapacitorPlugin(name = "Heading")
class HeadingPlugin : Plugin(), SensorEventListener {
  private lateinit var sensorManager: SensorManager
  private var accel = FloatArray(3)
  private var magnet = FloatArray(3)
  private var haveAccel = false
  private var haveMag = false
  private var useTrue = false
  private var lastLocation: Location? = null

  override fun load() {
    val sm = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager?
    if (sm != null) {
      sensorManager = sm
    }
    Log.i("HeadingPlugin", "load() - plugin initialized")
  }

  /** Returns current display rotation, falling back to ROTATION_0. */
  private fun currentDisplayRotation(): Int {
    // For API < 30 use defaultDisplay; safe-guard with fallback
    val r = activity?.windowManager?.defaultDisplay?.rotation
    return r ?: Surface.ROTATION_0
  }

  @PluginMethod
  fun start(call: PluginCall) {
    useTrue = call.getBoolean("useTrueNorth", false) ?: false
    val a = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    val m = sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD)
    if (a == null || m == null) {
      call.reject("Required sensors not available")
      return
    }
    sensorManager.registerListener(this, a, SensorManager.SENSOR_DELAY_GAME)
    sensorManager.registerListener(this, m, SensorManager.SENSOR_DELAY_GAME)
    Log.i("HeadingPlugin", "start() - sensors registered, useTrue=$useTrue")
    call.resolve()
  }

  @PluginMethod
  fun stop(call: PluginCall) {
    sensorManager.unregisterListener(this)
    haveAccel = false; haveMag = false
    Log.i("HeadingPlugin", "stop() - sensors unregistered")
    call.resolve()
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

  override fun onSensorChanged(e: SensorEvent) {
    when (e.sensor.type) {
        Sensor.TYPE_ACCELEROMETER -> {
            System.arraycopy(e.values, 0, accel, 0, 3)
            haveAccel = true
        }
        Sensor.TYPE_MAGNETIC_FIELD -> {
            System.arraycopy(e.values, 0, magnet, 0, 3)
            haveMag = true
        }
        // If you also register TYPE_ROTATION_VECTOR elsewhere, handle it separately.
    }
    if (!(haveAccel && haveMag)) return

    val R = FloatArray(9)
    val I = FloatArray(9)
    if (!SensorManager.getRotationMatrix(R, I, accel, magnet)) return

    // Remap for current display rotation so azimuth corresponds to "top edge = forward".
    val outR = FloatArray(9)
    when (currentDisplayRotation()) {
        Surface.ROTATION_0 -> {
            // Portrait (natural on most phones)
            SensorManager.remapCoordinateSystem(
                R, SensorManager.AXIS_X, SensorManager.AXIS_Y, outR
            )
        }
        Surface.ROTATION_90 -> {
            // Landscape, device rotated 90° clockwise
            SensorManager.remapCoordinateSystem(
                R, SensorManager.AXIS_Y, SensorManager.AXIS_MINUS_X, outR
            )
        }
        Surface.ROTATION_180 -> {
            // Upside-down portrait
            SensorManager.remapCoordinateSystem(
                R, SensorManager.AXIS_MINUS_X, SensorManager.AXIS_MINUS_Y, outR
            )
        }
        Surface.ROTATION_270 -> {
            // Landscape, device rotated 270° clockwise
            SensorManager.remapCoordinateSystem(
                R, SensorManager.AXIS_MINUS_Y, SensorManager.AXIS_X, outR
            )
        }
        else -> {
            System.arraycopy(R, 0, outR, 0, 9)
        }
    }

    // Optional: if users frequently hold the phone face-down, you can detect it
    // and flip Z to prevent mirrored azimuths. Uncomment if needed:
    // val faceDown = accel[2] < -3.0f // strong negative Z ~ face-down
    // if (faceDown) {
    //     val outR2 = FloatArray(9)
    //     SensorManager.remapCoordinateSystem(outR, SensorManager.AXIS_X, SensorManager.AXIS_MINUS_Y, outR2)
    //     System.arraycopy(outR2, 0, outR, 0, 9)
    // }

    val orientation = FloatArray(3)
    SensorManager.getOrientation(outR, orientation)

    // orientation[0] = azimuth (radians, -π..π), 0 = magnetic north, 90° = east (clockwise)
    var azimuthDeg = Math.toDegrees(orientation[0].toDouble())
    azimuthDeg = normalize0to360(azimuthDeg)

    val data = JSObject().apply {
        put("magnetic", azimuthDeg) // 0=N, 90=E, 180=S, 270=W
    }

    if (useTrue) {
      val loc = lastLocation
      if (loc != null) {
        val gmf = GeomagneticField(
          loc.latitude.toFloat(),
          loc.longitude.toFloat(),
          loc.altitude.toFloat(),
          System.currentTimeMillis()
        )
        val trueDeg = normalize0to360(azimuthDeg + gmf.declination)
        data.put("true", trueDeg)
      }
    }

    notifyListeners("heading", data)
  }


  // Optional: expose a method to update location from JS if you don't want the plugin to fetch it.
  @PluginMethod
  fun setLocation(call: PluginCall) {
    val lat = call.getDouble("lat")
    val lon = call.getDouble("lon")
    val alt = call.getDouble("alt") ?: 0.0
    if (lat == null || lon == null) { call.reject("lat/lon required"); return }
    val latV = lat!!
    val lonV = lon!!
    val l = Location("manual").apply {
      latitude = latV; longitude = lonV; altitude = alt
      time = System.currentTimeMillis(); elapsedRealtimeNanos = SystemClock.elapsedRealtimeNanos()
    }
    lastLocation = l
    Log.i("HeadingPlugin", "setLocation(lat=$latV, lon=$lonV, alt=$alt)")
    call.resolve()
  }
}
