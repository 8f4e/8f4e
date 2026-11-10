TARGET = 8f4e-field
CPP_SOURCES = src/field.cpp src/wamr-platform.cpp
APP_TYPE = BOOT_QSPI
USE_FATFS = 1

ifeq ($(LIBDAISY_DIR),)
$(error Set LIBDAISY_DIR to the built libDaisy checkout)
endif
ifeq ($(WAMR_DIR),)
$(error Set WAMR_DIR to the WAMR 2.4.5 source directory)
endif

WAMR_ARCHIVE = dist/wamr/libvmlib.a
C_INCLUDES += -Isrc -I$(WAMR_DIR)/core/iwasm/include -I$(WAMR_DIR)/core/shared/platform/include
LIBS += $(WAMR_ARCHIVE)
SYSTEM_FILES_DIR = $(LIBDAISY_DIR)/core
include $(SYSTEM_FILES_DIR)/Makefile

$(BUILD_DIR)/$(TARGET).elf: $(WAMR_ARCHIVE)
